"""DEMO/REFERENCE SCAFFOLD. See Exec-Assistant.md section 7 (file map) and
section 6 (commands) for what this module is meant to hold: audit,
approvals, anomalies, payments, cartogram, reminders, webhooks, mirroring,
skills. Not implemented here.
"""


def anomalies(_signal: list[float]) -> list[float]:
    """Median + MAD over a signal, with a floor for a flat series (section 5)."""
    raise NotImplementedError("see Exec-Assistant.md section 5 (the MAD floor)")


def payments(_csv_paths: list[str]):
    """Usage and unit cost from payments/*.csv, Decimal throughout (section 6)."""
    raise NotImplementedError("see Exec-Assistant.md section 6 (payments)")


def audit_append(_record: dict) -> None:
    """The append-only log of every write, refusal and send (section 13a)."""
    raise NotImplementedError("see Exec-Assistant.md section 13a (the audit log)")
