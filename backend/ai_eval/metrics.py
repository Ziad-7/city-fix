"""Sanitized evaluation metrics for existing Gemini-backed features."""

import hashlib
import json
import re
import unicodedata
from collections.abc import Sequence

import httpx

from app.recycling_schemas import MATERIAL_IDS


def canonical_prompt_hash(contract: dict) -> str:
    serialized = json.dumps(contract, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()


def waste_metrics(expected: list[dict], predicted: list[dict]) -> dict:
    if len(expected) != len(predicted) or not expected:
        raise ValueError("expected and predicted must have equal non-zero lengths")
    scores = []
    for material in MATERIAL_IDS:
        tp = sum(
            material in p["materials"] and material in e["materials"] for e, p in zip(expected, predicted, strict=True)
        )
        fp = sum(
            material in p["materials"] and material not in e["materials"]
            for e, p in zip(expected, predicted, strict=True)
        )
        fn = sum(
            material in e["materials"] and material not in p["materials"]
            for e, p in zip(expected, predicted, strict=True)
        )
        denom = 2 * tp + fp + fn
        scores.append(2 * tp / denom if denom else 0.0)
    size_accuracy = sum(e["size"] == p["size"] for e, p in zip(expected, predicted, strict=True)) / len(expected)
    return {"samples": len(expected), "macroF1": sum(scores) / len(scores), "sizeAccuracy": size_accuracy}


def normalize_arabic(text: str) -> str:
    text = unicodedata.normalize("NFKC", text).replace("ـ", "")
    text = re.sub(r"[\u064B-\u065F\u0670]", "", text)
    alef_map: dict[str | int, str | int | None] = {"أ": "ا", "إ": "ا", "آ": "ا"}
    text = text.translate(str.maketrans(alef_map))
    return " ".join(text.split())


def _edit_distance(a: Sequence, b: Sequence) -> int:
    previous = list(range(len(b) + 1))
    for i, left in enumerate(a, 1):
        current = [i]
        for j, right in enumerate(b, 1):
            current.append(min(current[-1] + 1, previous[j] + 1, previous[j - 1] + (left != right)))
        previous = current
    return previous[-1]


def is_timeout_error(error: BaseException) -> bool:
    """Recognize direct and wrapped HTTP/client deadlines without exposing error text."""
    seen: set[int] = set()
    pending = [error]
    while pending:
        current = pending.pop()
        if id(current) in seen:
            continue
        seen.add(id(current))
        if isinstance(current, (TimeoutError, httpx.TimeoutException)):
            return True
        if current.__cause__ is not None:
            pending.append(current.__cause__)
        if current.__context__ is not None:
            pending.append(current.__context__)
    return False


def transcription_metrics(references: list[str], hypotheses: list[str]) -> dict:
    if len(references) != len(hypotheses) or not references:
        raise ValueError("references and hypotheses must have equal non-zero lengths")
    wer, cer = [], []
    for reference, hypothesis in zip(references, hypotheses, strict=True):
        ref, hyp = normalize_arabic(reference), normalize_arabic(hypothesis)
        wer.append(
            0.0
            if not ref and not hyp
            else 1.0
            if not ref
            else _edit_distance(ref.split(), hyp.split()) / len(ref.split())
        )
        cer.append(0.0 if not ref and not hyp else 1.0 if not ref else _edit_distance(ref, hyp) / len(ref))
    return {"samples": len(references), "wer": sum(wer) / len(wer), "cer": sum(cer) / len(cer)}
