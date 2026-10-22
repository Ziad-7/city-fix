"""Durable device outbox and independent mock receiver stores."""
import json
import sqlite3
import threading
from datetime import datetime, timezone
from pathlib import Path
try:
    from .model import Policy, Sensors, validate_reading
except ImportError:
    from model import Policy, Sensors, validate_reading


class StoreError(RuntimeError): pass


def _json(value): return json.dumps(value, separators=(",", ":"), allow_nan=False)


class DeviceStore:
    def __init__(self, path: Path, identity: tuple[str, str, str]):
        self.path = Path(path); self.identity=tuple(identity); self.path.parent.mkdir(parents=True, exist_ok=True)
        self.lock = threading.RLock(); self.db = sqlite3.connect(self.path, check_same_thread=False, isolation_level=None)
        self.db.execute("PRAGMA journal_mode=WAL"); self.db.execute("PRAGMA synchronous=FULL")
        self.db.executescript("CREATE TABLE IF NOT EXISTS state (key TEXT PRIMARY KEY, value TEXT NOT NULL); CREATE TABLE IF NOT EXISTS outbox (seq INTEGER PRIMARY KEY, payload TEXT NOT NULL, full INTEGER NOT NULL, heat INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS events (id INTEGER PRIMARY KEY AUTOINCREMENT, event TEXT NOT NULL);")
        found = self.db.execute("SELECT value FROM state WHERE key='identity'").fetchone()
        if found and tuple(json.loads(found[0])) != tuple(identity):
            self.db.close(); raise StoreError("data directory belongs to a different bin, mode, or target; choose another data directory")
        if not found:
            self.db.execute("BEGIN IMMEDIATE")
            try:
                initial = {"identity": list(identity), "next_seq": 1, "sensors": Sensors().__dict__, "flags": [False,False], "policy": Policy().__dict__, "online": True, "ack_count": 0}
                for k,v in initial.items(): self.db.execute("INSERT INTO state VALUES(?,?)", (k,_json(v)))
                self.db.commit()
            except Exception: self.db.rollback(); raise

    def _state(self, key):
        row = self.db.execute("SELECT value FROM state WHERE key=?", (key,)).fetchone()
        if not row: raise StoreError("missing durable state")
        return json.loads(row[0])

    def _put(self, key, val): self.db.execute("INSERT INTO state VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", (key,_json(val)))

    def load_state(self):
        with self.lock:
            state = {k:self._state(k) for k in ("next_seq","sensors","flags","policy","online","ack_count")}
            state["sensors"] = Sensors(**state["sensors"])
            state["flags"] = tuple(state["flags"])
            state["policy"] = Policy(**state["policy"])
            return state

    def append(self, reading_without_seq: dict, sensors: Sensors, flags: tuple[bool,bool]) -> int:
        with self.lock:
            self.db.execute("BEGIN IMMEDIATE")
            try:
                seq = self._state("next_seq")
                if seq > 9007199254740991: raise StoreError("sequence space exhausted")
                if not isinstance(flags,(tuple,list)) or len(flags)!=2 or any(type(flag) is not bool for flag in flags): raise StoreError("invalid alert flags")
                payload = validate_reading({**reading_without_seq, "seq":seq})
                self.db.execute("INSERT INTO outbox VALUES(?,?,?,?)", (seq,_json(payload),int(bool(flags[0])),int(bool(flags[1]))))
                self._put("next_seq",seq+1); self._put("sensors",sensors.__dict__); self._put("flags",list(flags))
                self.db.commit(); return seq
            except Exception as exc:
                self.db.rollback()
                if isinstance(exc, StoreError): raise
                raise StoreError("sample was not saved") from exc

    def set_network(self, online: bool):
        if not isinstance(online,bool): raise StoreError("invalid network state")
        with self.lock: self._put("online",online)

    def pending(self, limit: int = 50):
        if not isinstance(limit,int) or not 1 <= limit <= 1000: raise StoreError("invalid batch limit")
        with self.lock:
            rows = self.db.execute("SELECT payload FROM outbox ORDER BY (full OR heat) DESC, seq LIMIT ?", (limit,)).fetchall()
            return [json.loads(row[0]) for row in rows]

    def apply_ack(self, sent_seqs: list[int], accepted: list[int], policy: Policy):
        if len(sent_seqs) != len(set(sent_seqs)) or len(accepted) != len(set(accepted)) or any(type(x) is not int or x < 1 for x in sent_seqs+accepted) or not set(accepted) <= set(sent_seqs): raise StoreError("invalid acknowledgement")
        if not isinstance(policy,Policy): raise StoreError("invalid policy")
        with self.lock:
            self.db.execute("BEGIN IMMEDIATE")
            try:
                present = {r[0] for r in self.db.execute("SELECT seq FROM outbox WHERE seq IN (%s)" % ",".join("?"*len(sent_seqs)), sent_seqs)} if sent_seqs else set()
                if present != set(sent_seqs): raise StoreError("acknowledgement refers to unknown sequence")
                for seq in accepted: self.db.execute("DELETE FROM outbox WHERE seq=?", (seq,))
                self._put("policy",policy.__dict__); self._put("ack_count",self._state("ack_count")+len(accepted))
                if accepted: self.db.execute("INSERT INTO events(event) VALUES(?)", (_json({"type":"ack","message":f"Accepted {len(accepted)} reading(s)","seqs":accepted}),))
                self.db.execute("DELETE FROM events WHERE id NOT IN (SELECT id FROM events ORDER BY id DESC LIMIT 100)")
                self.db.commit()
            except Exception:
                self.db.rollback(); raise

    def add_event(self, kind: str, message: str):
        if kind not in {"ack", "error"} or not isinstance(message,str): return
        safe = " ".join(message.split())[:200]
        with self.lock:
            self.db.execute("INSERT INTO events(event) VALUES(?)", (_json({"type":kind,"message":safe}),))
            self.db.execute("DELETE FROM events WHERE id NOT IN (SELECT id FROM events ORDER BY id DESC LIMIT 100)")

    def snapshot(self):
        with self.lock:
            rows = self.db.execute("SELECT payload,full,heat FROM outbox ORDER BY seq DESC LIMIT 100").fetchall()
            events = [json.loads(x[0]) for x in self.db.execute("SELECT event FROM events WHERE id IN (SELECT id FROM events ORDER BY id DESC LIMIT 30) ORDER BY id")]
            return {**self.load_state(), "outbox":[{**json.loads(r[0]),"flags":(bool(r[1]),bool(r[2]))} for r in rows], "pending_count":self.db.execute("SELECT count(*) FROM outbox").fetchone()[0], "events":events}

    def close(self):
        with self.lock: self.db.close()


class ReceiverStore:
    def __init__(self, path: Path):
        self.path=Path(path); self.path.parent.mkdir(parents=True,exist_ok=True); self.lock=threading.RLock()
        self.db=sqlite3.connect(self.path,check_same_thread=False,isolation_level=None)
        self.db.execute("PRAGMA journal_mode=WAL"); self.db.execute("PRAGMA synchronous=FULL")
        self.db.execute("CREATE TABLE IF NOT EXISTS readings(bin TEXT NOT NULL, seq INTEGER NOT NULL, payload TEXT NOT NULL, arrived TEXT NOT NULL, PRIMARY KEY(bin,seq))")

    def accept(self, bin_id: str, readings: list[dict], arrived_at: datetime):
        checked=[]
        try:
            seen=set()
            for item in readings:
                v=validate_reading(item)
                if v["seq"] in seen: raise ValueError()
                seen.add(v["seq"]); checked.append(v)
        except Exception as exc: raise StoreError("invalid reading batch") from exc
        with self.lock:
            self.db.execute("BEGIN IMMEDIATE")
            try:
                for r in checked:
                    old=self.db.execute("SELECT payload FROM readings WHERE bin=? AND seq=?",(bin_id,r["seq"])).fetchone()
                    if old and json.loads(old[0]) != r: raise StoreError("sequence payload conflict")
                for r in checked:
                    self.db.execute("INSERT OR IGNORE INTO readings VALUES(?,?,?,?)",(bin_id,r["seq"],_json(r),arrived_at.isoformat()))
                self.db.commit(); return [r["seq"] for r in checked]
            except Exception:
                self.db.rollback(); raise

    def snapshot(self, bin_id: str, policy: Policy):
        with self.lock:
            rows=self.db.execute("SELECT payload,arrived FROM readings WHERE bin=? ORDER BY seq DESC LIMIT 100",(bin_id,)).fetchall()
            entries=[]
            for raw, arrived in rows:
                r=json.loads(raw); temp=r.get("tempC"); r["arrivedAt"]=arrived; r["full"]=r["fillPct"]>=policy.full_pct; r["heat"]=temp is not None and temp>=policy.heat_c; entries.append(r)
            return {"count":self.db.execute("SELECT count(*) FROM readings WHERE bin=?",(bin_id,)).fetchone()[0],"latest":entries[0] if entries else None,"readings":entries}

    def close(self):
        with self.lock: self.db.close()
