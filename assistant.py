#!/usr/bin/env python3
"""DEMO/REFERENCE SCAFFOLD for the commitments assistant.

See ../Exec-Assistant.md for the full brief. Standard library only, per
invariant 1. This is a minimal, runnable skeleton, not the complete
implementation -- most subcommands are stubs that point back at the
section of the brief describing the real behavior.
"""
from __future__ import annotations

import argparse
import re
import sys
import uuid
from datetime import date, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent
INBOX = ROOT / "inbox"
PEOPLE = ROOT / "people"
SESSIONS = ROOT / "notes" / "sessions"
LOG = ROOT / "log"
TASKS = ROOT / "tasks.md"
BRIEF = ROOT / "brief.md"

# Section 4: verbs are split. ANYWHERE_VERBS count anywhere in the line;
# IMPERATIVE_VERBS count only at the start. Matched on word boundaries,
# never substrings -- a substring test misclassifies "the task list is
# long" and "their asks are unclear" as tasks.
ANYWHERE_VERBS = [
    "send", "ask", "draft", "review", "follow up", "confirm", "reconcile",
    "close out", "rotate", "deploy", "promote", "provision", "redeploy",
    "roll back", "cut over", "rerun", "cordon", "terminate", "recreate",
    "resize", "reissue", "revoke", "decommission", "upgrade", "migrate",
]
IMPERATIVE_VERBS = [
    "write", "call", "email", "schedule", "check", "raise", "document",
    "fix", "update", "add", "remove", "set", "pin", "bump", "patch",
    "refactor", "rename", "delete", "clean up", "restart", "scale", "tag",
    "publish", "enable", "disable", "restore", "back up", "drain", "apply",
    "renew", "grant",
]

DATE_PHRASE_RE = re.compile(
    r"\bby (\d{4}-\d{2}-\d{2}|friday|monday|tuesday|wednesday|thursday|saturday|sunday)\b",
    re.IGNORECASE,
)


def _word_boundary_pattern(phrases: list[str]) -> re.Pattern:
    alternation = "|".join(re.escape(p) for p in phrases)
    return re.compile(rf"\b(?:{alternation})\b", re.IGNORECASE)


ANYWHERE_RE = _word_boundary_pattern(ANYWHERE_VERBS)
IMPERATIVE_RE = _word_boundary_pattern(IMPERATIVE_VERBS)


def is_task(line: str) -> bool:
    """Section 4: a task if an anywhere-verb appears anywhere as a word, or
    an imperative verb appears at the start. Word-boundary matched."""
    stripped = line.strip()
    if ANYWHERE_RE.search(stripped):
        return True
    return IMPERATIVE_RE.match(stripped) is not None


def strip_date_phrase(title: str) -> tuple[str, str | None]:
    """Section 4: the date phrase is stripped from the title only when the
    date resolved. Returns (title, due_date_or_None).

    DEMO SCAFFOLD: only ISO dates (YYYY-MM-DD) resolve here. Weekday
    phrases ("by friday") are left unresolved -- see Exec-Assistant.md
    section 4 for the real date-resolution logic.
    """
    m = DATE_PHRASE_RE.search(title)
    if not m:
        return title, None
    token = m.group(1)
    if re.match(r"\d{4}-\d{2}-\d{2}", token):
        return DATE_PHRASE_RE.sub("", title).strip(), token
    return title, None


def cmd_init(_args: argparse.Namespace) -> None:
    for d in (INBOX, PEOPLE, SESSIONS, LOG, ROOT / "config"):
        d.mkdir(parents=True, exist_ok=True)
    if not TASKS.exists():
        TASKS.write_text("## I owe\n\n## Waiting on\n\n## Done\n", encoding="utf-8")
    if not BRIEF.exists():
        BRIEF.write_text("# Brief\n\n(nothing filed yet -- run `file` then `brief`)\n", encoding="utf-8")
    print(f"initialized store at {ROOT}")


def cmd_capture(args: argparse.Namespace) -> None:
    INBOX.mkdir(parents=True, exist_ok=True)
    capture_id = uuid.uuid4().hex[:6]
    now = datetime.now().astimezone().isoformat(timespec="seconds")
    path = INBOX / f"{capture_id}.md"
    path.write_text(
        f"---\ncaptured: {now}\nid: {capture_id}\nsource: cli\nstatus: unresolved\n---\n{args.text}\n",
        encoding="utf-8",
    )
    print(f"captured: {path}")


def cmd_file(_args: argparse.Namespace) -> None:
    if not INBOX.exists():
        print("no inbox/ -- run init first")
        return
    lines_out = []
    for capture_file in sorted(INBOX.glob("*.md")):
        text = capture_file.read_text(encoding="utf-8")
        body = text.split("---\n", 2)[-1].strip()
        title, due = strip_date_phrase(body)
        if is_task(body):
            due_part = f" (due {due})" if due else ""
            lines_out.append(
                f"- [ ] {title}{due_part} <!--{capture_file.stem} {date.today().isoformat()} rolled:0-->"
            )
        capture_file.unlink()
    if lines_out:
        current = TASKS.read_text(encoding="utf-8") if TASKS.exists() else "## I owe\n\n## Waiting on\n\n## Done\n"
        marker = "## I owe\n"
        idx = current.find(marker) + len(marker)
        current = current[:idx] + "\n".join(lines_out) + "\n" + current[idx:]
        TASKS.write_text(current, encoding="utf-8")
    print(f"filed {len(lines_out)} item(s)")


def cmd_brief(_args: argparse.Namespace) -> None:
    if not TASKS.exists():
        print("no tasks.md -- run init first")
        return
    BRIEF.write_text(
        f"# Brief -- {date.today().isoformat()}\n\n" + TASKS.read_text(encoding="utf-8"),
        encoding="utf-8",
    )
    print(f"wrote {BRIEF}")


def cmd_site(_args: argparse.Namespace) -> None:
    site = ROOT / "site"
    site.mkdir(exist_ok=True)
    # DEMO SCAFFOLD: one page. No <script>, dark theme only -- invariants 6 & 7.
    (site / "index.html").write_text(
        "<!doctype html><html><head><meta charset='utf-8'>"
        "<link rel='stylesheet' href='../assets/night.css'>"
        "<title>Assistant (demo)</title></head>"
        "<body><h1>Assistant -- demo scaffold</h1>"
        "<p>See Exec-Assistant.md for the full 8-page static site spec.</p>"
        "</body></html>",
        encoding="utf-8",
    )
    print(f"wrote {site / 'index.html'}")


def _not_implemented(name: str, section: str) -> None:
    print(f"'{name}' is not implemented in this demo scaffold -- see Exec-Assistant.md {section}")


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="assistant.py", description="DEMO/REFERENCE SCAFFOLD -- see Exec-Assistant.md")
    sub = p.add_subparsers(dest="command", required=True)

    sub.add_parser("init").set_defaults(func=cmd_init)

    capture_p = sub.add_parser("capture")
    capture_p.add_argument("text")
    capture_p.set_defaults(func=cmd_capture)

    sub.add_parser("file").set_defaults(func=cmd_file)
    sub.add_parser("brief").set_defaults(func=cmd_brief)
    sub.add_parser("site").set_defaults(func=cmd_site)

    stub_commands = {
        "event": "section 6 (event ... --template)",
        "note": "section 6 (note ...)",
        "summarize": "section 6 (summarize)",
        "prep": "section 6 (prep <person>)",
        "eod": "section 6 (eod)",
        "week": "section 6 (week)",
        "serve": "section 6 (serve)",
        "why": "section 6 (why <id>)",
        "anomalies": "section 6 (anomalies)",
        "remind": "section 6 (remind)",
        "payments": "section 6 (payments)",
        "mirror": "section 6 (mirror)",
        "skill": "section 6 (skill)",
        "audit": "section 13a (the audit log)",
        "export": "section 6 (export / import)",
        "import": "section 6 (export / import)",
        "twin": "section 11 (the parity harness)",
        "ingest": "section 10a / Spec-Ingest-Tool.md",
    }
    for name, section in stub_commands.items():
        sp = sub.add_parser(name)
        sp.add_argument("rest", nargs="*")
        sp.set_defaults(func=lambda a, n=name, s=section: _not_implemented(n, s))

    return p


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    args.func(args)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
