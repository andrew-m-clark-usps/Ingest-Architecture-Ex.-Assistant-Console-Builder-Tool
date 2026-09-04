"""See Exec-Assistant.md section 5 (the MAD floor), section 6 (payments),
and section 13a (the audit log). Standard library only, per invariant 1.
"""
from __future__ import annotations

import csv
import json
import statistics
from datetime import date
from decimal import Decimal, InvalidOperation
from pathlib import Path

ROOT = Path(__file__).resolve().parent
AUDIT_LOG = ROOT / "log" / "audit.jsonl"

# Without a floor, the MAD (median absolute deviation) of a perfectly flat
# series is 0, and dividing by it scores every tiny change as an infinite
# anomaly.
MAD_FLOOR = 1e-6


def anomalies(signal: list[float]) -> list[float]:
    """Median + MAD anomaly score per point, with a floor on the MAD so a
    flat series never divides by zero."""
    if not signal:
        return []
    med = statistics.median(signal)
    mad = statistics.median(abs(x - med) for x in signal)
    mad = max(mad, MAD_FLOOR)
    return [abs(x - med) / mad for x in signal]


def payments(csv_paths: list[str]) -> dict[str, Decimal | int]:
    """Usage and unit cost from payments/*.csv. Decimal throughout -- never
    float, since floating-point cents drift is unacceptable in money math.
    Expects columns `amount` and `units`; malformed rows are skipped, not
    guessed at."""
    total_amount = Decimal("0")
    total_units = 0
    rows_read = 0
    for csv_path in csv_paths:
        path = Path(csv_path)
        if not path.exists():
            continue
        with path.open(newline="", encoding="utf-8") as f:
            for row in csv.DictReader(f):
                rows_read += 1
                try:
                    amount = Decimal(row.get("amount") or "0")
                    units = int(row.get("units") or "0")
                except (InvalidOperation, ValueError):
                    continue
                total_amount += amount
                total_units += units
    unit_cost = (total_amount / total_units) if total_units else Decimal("0")
    return {
        "rows_read": rows_read,
        "total_amount": total_amount,
        "total_units": total_units,
        "unit_cost": unit_cost,
    }


def audit_append(record: dict) -> None:
    """The append-only log of every write, refusal, and send (section
    13a). Logs identifiers/counts/paths/refusals -- never the extracted
    content itself, which would create an unmanaged second copy of
    potentially sensitive material."""
    AUDIT_LOG.parent.mkdir(parents=True, exist_ok=True)
    entry = {"at": date.today().isoformat(), **record}
    with AUDIT_LOG.open("a", encoding="utf-8") as f:
        f.write(json.dumps(entry, sort_keys=True, default=str) + "\n")
