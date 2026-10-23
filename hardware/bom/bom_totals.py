#!/usr/bin/env python3
"""Validate hardware/bom/bom.csv and print the sourced subtotal.

A price exists only on a line with status=sourced, a supplier URL, an ISO date and an
evidence type. The script never fills in or estimates a missing price. While any line is
unsourced the output says PARTIAL: the subtotal is not a per-bin cost.
Exit code 1 on schema errors.
"""
import csv
import sys
from datetime import date
from decimal import Decimal, InvalidOperation
from pathlib import Path

CSV_PATH = Path(__file__).resolve().parent / "bom.csv"
COLUMNS = ["line_id", "block", "part", "spec", "qty_per_bin", "unit_price_egp", "supplier", "supplier_url",
           "price_date", "evidence", "status", "alternatives", "notes"]
EVIDENCE = {"page", "search_snippet", "quote", "none"}
STATUS = {"sourced", "to_verify"}


def load(path=CSV_PATH):
    with open(path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        if reader.fieldnames != COLUMNS:
            raise ValueError(f"columns must be exactly: {','.join(COLUMNS)}")
        return list(reader)


def validate(rows):
    errors, seen = [], set()
    for r in rows:
        lid = r["line_id"] or "?"
        if lid in seen:
            errors.append(f"{lid}: duplicate line_id")
        seen.add(lid)
        if r["status"] not in STATUS:
            errors.append(f"{lid}: status must be one of {sorted(STATUS)}")
        if r["evidence"] not in EVIDENCE:
            errors.append(f"{lid}: evidence must be one of {sorted(EVIDENCE)}")
        try:
            if int(r["qty_per_bin"]) <= 0:
                errors.append(f"{lid}: qty_per_bin must be > 0")
        except ValueError:
            errors.append(f"{lid}: qty_per_bin is not an integer")
        has_price = r["unit_price_egp"].strip() != ""
        if (r["status"] == "sourced") != has_price:
            errors.append(f"{lid}: price must be present exactly when status=sourced")
        if has_price:
            try:
                if Decimal(r["unit_price_egp"]) <= 0:
                    errors.append(f"{lid}: price must be > 0")
            except InvalidOperation:
                errors.append(f"{lid}: price is not a number")
        if r["status"] == "sourced":
            if not r["supplier_url"].startswith("https://"):
                errors.append(f"{lid}: sourced line needs an https supplier_url")
            if not r["supplier"]:
                errors.append(f"{lid}: sourced line needs a supplier")
            if r["evidence"] == "none":
                errors.append(f"{lid}: sourced line needs evidence other than none")
            try:
                date.fromisoformat(r["price_date"])
            except ValueError:
                errors.append(f"{lid}: sourced line needs an ISO price_date")
        elif r["supplier_url"] or r["price_date"] or r["evidence"] != "none":
            errors.append(f"{lid}: to_verify line must have empty url/date and evidence=none")
    return errors


def totals(rows):
    """Return (one_time_subtotal, monthly_subtotal, unsourced_rows, sourced_rows). Alternatives are not counted."""
    one_time = monthly = Decimal("0")
    unsourced, sourced = [], []
    for r in rows:
        if r["block"] == "alternative":
            continue
        if r["status"] == "to_verify":
            unsourced.append(r)
            continue
        sourced.append(r)
        line = Decimal(r["unit_price_egp"]) * int(r["qty_per_bin"])
        if r["block"] == "running_cost":
            monthly += line
        else:
            one_time += line
    return one_time, monthly, unsourced, sourced


def main():
    try:
        rows = load()
    except (OSError, ValueError) as e:
        print(f"ERROR: {e}")
        return 1
    errors = validate(rows)
    if errors:
        print("BOM schema errors:")
        for e in errors:
            print(f"  - {e}")
        return 1
    one_time, monthly, unsourced, sourced = totals(rows)
    counted = len(sourced) + len(unsourced)
    print(f"BOM lines counted: {counted} (sourced {len(sourced)}, to_verify {len(unsourced)}); alternatives listed but not counted: "
          f"{sum(1 for r in rows if r['block'] == 'alternative')}")
    print(f"One-time hardware, sourced lines only: {one_time:.2f} EGP")
    print(f"Monthly running cost, sourced lines only: {monthly:.2f} EGP")
    if unsourced:
        print("PARTIAL: not a per-bin cost. Lines still to verify:")
        for r in unsourced:
            kind = "monthly" if r["block"] == "running_cost" else "one-time"
            print(f"  {r['line_id']} ({kind}) {r['part']}")
    else:
        print("All counted lines are sourced.")
    print("Prices are EGP as listed by the supplier on the stated date; nothing converted from another currency.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
