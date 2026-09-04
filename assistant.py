#!/usr/bin/env python3
"""The commitments assistant CLI.

See ../Exec-Assistant.md for the full brief. Standard library only, per
invariant 1.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import uuid
import zipfile
from datetime import date, datetime, timedelta
from pathlib import Path

import features

ROOT = Path(__file__).resolve().parent
INBOX = ROOT / "inbox"
PEOPLE = ROOT / "people"
SESSIONS = ROOT / "notes" / "sessions"
LOG = ROOT / "log"
TASKS = ROOT / "tasks.md"
BRIEF = ROOT / "brief.md"
WEEKLY = ROOT / "weekly.md"
AUDIT_LOG = LOG / "audit.jsonl"

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

WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]

DATE_PHRASE_RE = re.compile(
    r"\bby (\d{4}-\d{2}-\d{2}|friday|monday|tuesday|wednesday|thursday|saturday|sunday)\b",
    re.IGNORECASE,
)

# A task line as written by cmd_file/cmd_eod:
# "- [ ] title (due 2026-06-01) <!--id captured rolled:0 ...-->"
# Title/comment are bounded to exclude '<'/'>' (neither ever appears in
# either) rather than using an unbounded lazy `.*?` -- functionally
# identical for every valid line, but removes the ambiguous-backtracking
# shape a hostile/malformed line could otherwise exploit.
LINE_RE = re.compile(r"^- \[([ x])\] ([^<]*?)(?: \(due (\d{4}-\d{2}-\d{2})\))? <!--([^>]*)-->\s*$")
SECTION_I_OWE = "## I owe"
SECTION_WAITING_ON = "## Waiting on"
SECTION_DONE = "## Done"
SECTION_HEADERS = [SECTION_I_OWE, SECTION_WAITING_ON, SECTION_DONE]
NO_TASKS_MESSAGE = "no tasks.md -- run init first"
NONE_PLACEHOLDER = "(none)"

SUMMARY_START = "<!--summary-->"
SUMMARY_END = "<!--/summary-->"

# Credential shapes the mirror check refuses to push a copy containing --
# same category of pattern the spec-ingest tool scans generated output
# for (Spec-Ingest-Tool.md section 2a / security posture).
CREDENTIAL_PATTERNS = [
    re.compile(r"\bBearer [A-Za-z0-9._-]{10,}\b"),
    re.compile(r"\bBasic [A-Za-z0-9+/=]{10,}\b"),
    re.compile(r"\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b"),  # JWT
    re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----"),
    re.compile(r"\bclient_secret\s*[:=]\s*\S+"),
]


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


def _now() -> datetime:
    """The one clock-reading function in this module (invariant 5) --
    overridable via ASSISTANT_NOW so eod/week/capture are testable without
    waiting for a real day to pass."""
    override = os.environ.get("ASSISTANT_NOW")
    if override:
        return datetime.fromisoformat(override)
    return datetime.now().astimezone()


def _today() -> date:
    return _now().date()


def _resolve_weekday(name: str, today: date) -> date:
    target = WEEKDAYS.index(name.lower())
    delta = (target - today.weekday()) % 7
    delta = delta or 7  # "by friday" ON a Friday means next Friday, not today
    return today + timedelta(days=delta)


def strip_date_phrase(title: str, today: date | None = None) -> tuple[str, str | None]:
    """Section 4: the date phrase is stripped from the title only when the
    date resolved. Returns (title, due_date_or_None). ISO dates resolve
    directly; weekday phrases ("by friday") resolve to the next occurrence
    of that weekday from `today` (or the real clock if not supplied)."""
    m = DATE_PHRASE_RE.search(title)
    if not m:
        return title, None
    token = m.group(1)
    if re.match(r"\d{4}-\d{2}-\d{2}", token):
        return DATE_PHRASE_RE.sub("", title).strip(), token
    resolved = _resolve_weekday(token, today or _today())
    return DATE_PHRASE_RE.sub("", title).strip(), resolved.isoformat()


def _parse_comment_fields(comment: str) -> tuple[str, str, dict[str, str]]:
    """A task's trailing HTML comment is `id captured key:value ...` --
    any key:value pair this code doesn't recognize is preserved verbatim
    on round-trip (invariant 4: unrecognized comment fields survive a
    sweep/roll)."""
    tokens = comment.split()
    item_id = tokens[0] if tokens else ""
    captured = tokens[1] if len(tokens) > 1 else ""
    fields: dict[str, str] = {}
    for tok in tokens[2:]:
        if ":" in tok:
            key, _, value = tok.partition(":")
            fields[key] = value
    return item_id, captured, fields


def _rebuild_comment(item_id: str, captured: str, fields: dict[str, str]) -> str:
    parts = [item_id, captured] + [f"{k}:{v}" for k, v in fields.items()]
    return "<!--" + " ".join(parts) + "-->"


def _split_sections(text: str) -> dict[str, list[str]]:
    sections: dict[str, list[str]] = {h: [] for h in SECTION_HEADERS}
    current: str | None = None
    for line in text.splitlines():
        if line.strip() in SECTION_HEADERS:
            current = line.strip()
            continue
        if current is not None:
            sections[current].append(line)
    return sections


def _join_sections(sections: dict[str, list[str]]) -> str:
    parts: list[str] = []
    for header in SECTION_HEADERS:
        parts.append(header)
        parts.extend(sections[header])
        parts.append("")
    return "\n".join(parts).rstrip() + "\n"


def read_session(path: Path) -> str:
    """Reads a session file's raw notes, skipping the <!--summary--> region
    so a previously written summary never re-appears as a duplicate
    decision when this session is read again for prep."""
    text = path.read_text(encoding="utf-8")
    start = text.find(SUMMARY_START)
    if start == -1:
        return text
    end = text.find(SUMMARY_END, start)
    if end == -1:
        return text[:start]
    return text[:start] + text[end + len(SUMMARY_END):]


def _classify_session_lines(text: str) -> dict[str, list[str]]:
    actions: list[str] = []
    waiting: list[str] = []
    decisions: list[str] = []
    open_questions: list[str] = []
    for raw_line in text.splitlines():
        stripped = raw_line.strip("- \t")
        if not stripped or stripped.startswith("#") or stripped.startswith("---"):
            continue
        lowered = stripped.lower()
        if stripped.endswith("?"):
            open_questions.append(stripped)
        elif "waiting on" in lowered:
            waiting.append(stripped)
        elif lowered.startswith(("decided", "decision")):
            decisions.append(stripped)
        elif is_task(stripped):
            actions.append(stripped)
    return {"actions": actions, "waiting": waiting, "decisions": decisions, "open_questions": open_questions}


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
    now = _now().isoformat(timespec="seconds")
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
                f"- [ ] {title}{due_part} <!--{capture_file.stem} {_today().isoformat()} rolled:0-->"
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
        print(NO_TASKS_MESSAGE)
        return
    BRIEF.write_text(
        f"# Brief -- {_today().isoformat()}\n\n" + TASKS.read_text(encoding="utf-8"),
        encoding="utf-8",
    )
    print(f"wrote {BRIEF}")


def cmd_site(_args: argparse.Namespace) -> None:
    site = ROOT / "site"
    site.mkdir(exist_ok=True)
    # One page. No <script>, dark theme only -- invariants 6 & 7.
    (site / "index.html").write_text(
        "<!doctype html><html><head><meta charset='utf-8'>"
        "<link rel='stylesheet' href='../assets/night.css'>"
        "<title>Assistant</title></head>"
        "<body><h1>Assistant</h1>"
        "<p>See Exec-Assistant.md for the full 8-page static site spec.</p>"
        "</body></html>",
        encoding="utf-8",
    )
    print(f"wrote {site / 'index.html'}")


def cmd_event(args: argparse.Namespace) -> None:
    # Section 6: an event plus prep items, each due the day before.
    prep_date = date.fromisoformat(args.date) - timedelta(days=1)
    INBOX.mkdir(parents=True, exist_ok=True)
    capture_id = uuid.uuid4().hex[:6]
    now = _now().isoformat(timespec="seconds")
    text = f"prepare for {args.title} (event {args.date}) by {prep_date.isoformat()}"
    path = INBOX / f"{capture_id}.md"
    path.write_text(
        f"---\ncaptured: {now}\nid: {capture_id}\nsource: event\nstatus: unresolved\n"
        f"template: {args.template or ''}\n---\n{text}\n",
        encoding="utf-8",
    )
    print(f"captured prep item for '{args.title}': {path}")


def cmd_note(args: argparse.Namespace) -> None:
    SESSIONS.mkdir(parents=True, exist_ok=True)
    session_id = f"{_now().strftime('%Y%m%dT%H%M%S')}-{uuid.uuid4().hex[:6]}"
    path = SESSIONS / f"{session_id}.md"
    attendees = [a.strip() for a in args.attendees.split(",")] if args.attendees else []
    path.write_text(
        f"---\nstarted: {_now().isoformat(timespec='seconds')}\nattendees: {', '.join(attendees)}\n"
        f"---\n# {args.title}\n\n",
        encoding="utf-8",
    )
    print(f"session started: {path}")
    print("type notes, one line per Enter press (Ctrl+D / Ctrl+Z then Enter to end):")
    for line in sys.stdin:
        with path.open("a", encoding="utf-8") as f:
            f.write(line if line.endswith("\n") else line + "\n")
    print(f"session saved: {path}")


def cmd_summarize(_args: argparse.Namespace) -> None:
    if not SESSIONS.exists():
        print("no notes/sessions/ -- run init first")
        return
    count = 0
    for session_file in sorted(SESSIONS.glob("*.md")):
        raw_full = session_file.read_text(encoding="utf-8")
        if SUMMARY_START in raw_full:
            continue  # already summarized
        parts = _classify_session_lines(read_session(session_file))
        summary_lines = ["", SUMMARY_START, "## Summary"]
        for label, key in (
            ("Actions", "actions"),
            ("Waiting on", "waiting"),
            ("Decisions", "decisions"),
            ("Open questions", "open_questions"),
        ):
            summary_lines.append(f"### {label}")
            if parts[key]:
                summary_lines.extend(f"- {item}" for item in parts[key])
            else:
                summary_lines.append(NONE_PLACEHOLDER)
        summary_lines.append(SUMMARY_END)
        with session_file.open("a", encoding="utf-8") as f:
            f.write("\n".join(summary_lines) + "\n")
        count += 1
    print(f"summarized {count} session(s)")


def _session_insights_for(lowered: str) -> tuple[list[str], list[str]]:
    decisions: list[str] = []
    open_questions: list[str] = []
    if not SESSIONS.exists():
        return decisions, open_questions
    for session_file in sorted(SESSIONS.glob("*.md")):
        raw = read_session(session_file)
        if lowered not in raw.lower():
            continue
        parts = _classify_session_lines(raw)
        decisions.extend(parts["decisions"])
        open_questions.extend(parts["open_questions"])
    return decisions, open_questions


def _print_prep_for_person(name: str, sections: dict[str, list[str]]) -> None:
    lowered = name.lower()
    you_owe = [line for line in sections[SECTION_I_OWE] if lowered in line.lower()]
    they_owe = [line for line in sections[SECTION_WAITING_ON] if lowered in line.lower()]
    decisions, open_questions = _session_insights_for(lowered)
    print(f"# Prep -- {name}")
    print("## You owe them")
    print("\n".join(you_owe) or NONE_PLACEHOLDER)
    print("## They owe you")
    print("\n".join(they_owe) or NONE_PLACEHOLDER)
    print("## Prior decisions")
    print("\n".join(decisions) or NONE_PLACEHOLDER)
    print("## Open questions")
    print("\n".join(open_questions) or NONE_PLACEHOLDER)


def cmd_prep(args: argparse.Namespace) -> None:
    names = args.people or []
    if not names:
        print("usage: assistant.py prep <person> [<person> ...]")
        return
    empty_sections = {h: [] for h in SECTION_HEADERS}
    sections = _split_sections(TASKS.read_text(encoding="utf-8")) if TASKS.exists() else empty_sections
    for name in names:
        _print_prep_for_person(name, sections)


def cmd_eod(_args: argparse.Namespace) -> None:
    if not TASKS.exists():
        print(NO_TASKS_MESSAGE)
        return
    today = _today()
    sections = _split_sections(TASKS.read_text(encoding="utf-8"))

    swept = 0
    rolled = 0
    for header in (SECTION_I_OWE, SECTION_WAITING_ON):
        remaining: list[str] = []
        for line in sections[header]:
            m = LINE_RE.match(line)
            if not m:
                remaining.append(line)
                continue
            checked, title, due, comment = m.groups()
            if checked == "x":
                sections[SECTION_DONE].append(line)
                swept += 1
                continue
            if due and due < today.isoformat():
                item_id, captured, fields = _parse_comment_fields(comment)
                # Roll forward: only the rolled count changes. The due
                # date itself NEVER moves (invariant per Exec-Assistant.md
                # section 6/eod).
                fields["rolled"] = str(int(fields.get("rolled", "0")) + 1)
                rolled += 1
                remaining.append(f"- [ ] {title} (due {due}) {_rebuild_comment(item_id, captured, fields)}")
            else:
                remaining.append(line)
        sections[header] = remaining

    TASKS.write_text(_join_sections(sections), encoding="utf-8")

    LOG.mkdir(parents=True, exist_ok=True)
    log_path = LOG / f"{today.isoformat()}.md"
    log_path.write_text(f"# End of day -- {today.isoformat()}\n\nswept: {swept}\nrolled: {rolled}\n", encoding="utf-8")
    features.audit_append({"action": "eod", "swept": swept, "rolled": rolled, "date": today.isoformat()})
    print(f"eod: swept {swept}, rolled {rolled} -- see {log_path}")


def _line_activity_entry(line: str, week_start: date) -> str | None:
    """Returns the weekly-summary bullet for `line` if it falls in the
    window (or has no captured date to compare), else None."""
    m = LINE_RE.match(line)
    if not m:
        return None
    _checked, title, due, comment = m.groups()
    _item_id, captured, _fields = _parse_comment_fields(comment)
    try:
        captured_date = date.fromisoformat(captured)
    except ValueError:
        captured_date = None
    if captured_date is not None and captured_date < week_start:
        return None
    return f"- {title}" + (f" (due {due})" if due else "")


def _count_section_activity(
    sections: dict[str, list[str]], week_start: date
) -> tuple[dict[str, int], dict[str, list[str]]]:
    counts = dict.fromkeys(SECTION_HEADERS, 0)
    in_window: dict[str, list[str]] = {h: [] for h in SECTION_HEADERS}
    for header in SECTION_HEADERS:
        for line in sections[header]:
            entry = _line_activity_entry(line, week_start)
            if entry is None:
                continue
            counts[header] += 1
            in_window[header].append(entry)
    return counts, in_window


def cmd_week(_args: argparse.Namespace) -> None:
    if not TASKS.exists():
        print(NO_TASKS_MESSAGE)
        return
    today = _today()
    week_start = today - timedelta(days=6)
    sections = _split_sections(TASKS.read_text(encoding="utf-8"))
    counts, in_window = _count_section_activity(sections, week_start)

    body = [f"# Week of {week_start.isoformat()} -- {today.isoformat()}", ""]
    for header in SECTION_HEADERS:
        label = header.replace("## ", "")
        body.append(f"## {label} ({counts[header]})")
        body.extend(in_window[header] or [NONE_PLACEHOLDER])
        body.append("")
    WEEKLY.write_text("\n".join(body).rstrip() + "\n", encoding="utf-8")
    features.audit_append({"action": "week", "counts": counts})
    print(f"wrote {WEEKLY}")


def cmd_serve(args: argparse.Namespace) -> None:
    import http.server
    import socketserver

    cmd_site(args)
    site_dir = ROOT / "site"

    class Handler(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *a, **kw):
            super().__init__(*a, directory=str(site_dir), **kw)

    # Loopback only -- no flag exists to bind anywhere else.
    with socketserver.TCPServer(("127.0.0.1", 8787), Handler) as httpd:
        print("serving on http://127.0.0.1:8787 (loopback only, no flag to change it)")
        httpd.serve_forever()


def cmd_why(args: argparse.Namespace) -> None:
    if not TASKS.exists():
        print(NO_TASKS_MESSAGE)
        return
    sections = _split_sections(TASKS.read_text(encoding="utf-8"))
    for header in SECTION_HEADERS:
        for line in sections[header]:
            m = LINE_RE.match(line)
            if not m:
                continue
            _checked, title, due, comment = m.groups()
            item_id, captured, fields = _parse_comment_fields(comment)
            if item_id == args.item_id:
                print(f"# Why -- {args.item_id}")
                print(f"captured: {captured}")
                print(f"classified as a task: {is_task(title)}")
                print(f"section: {header}")
                if due:
                    print(f"due: {due} (rolled {fields.get('rolled', '0')} time(s))")
                return
    print(f"no item found with id {args.item_id}")


def cmd_anomalies(args: argparse.Namespace) -> None:
    signal = [float(x) for x in args.values]
    scores = features.anomalies(signal)
    for value, score in zip(signal, scores):
        print(f"{value}\t{score:.3f}")


def _reminded_item_ids_today(today: str) -> set[str]:
    already_today: set[str] = set()
    if not AUDIT_LOG.exists():
        return already_today
    for line in AUDIT_LOG.read_text(encoding="utf-8").splitlines():
        try:
            rec = json.loads(line)
        except json.JSONDecodeError:
            continue
        if rec.get("action") == "remind" and rec.get("at") == today:
            already_today.add(rec.get("item_id", ""))
    return already_today


def cmd_remind(_args: argparse.Namespace) -> None:
    if not TASKS.exists():
        print(NO_TASKS_MESSAGE)
        return
    already_today = _reminded_item_ids_today(_today().isoformat())

    sections = _split_sections(TASKS.read_text(encoding="utf-8"))
    reminded = 0
    for line in sections[SECTION_WAITING_ON]:
        m = LINE_RE.match(line)
        if not m:
            continue
        _checked, title, _due, comment = m.groups()
        item_id, _captured, _fields = _parse_comment_fields(comment)
        if item_id in already_today:
            continue
        print(f"remind: {title}")
        features.audit_append({"action": "remind", "item_id": item_id})
        reminded += 1
    print(f"{reminded} reminder(s) issued (each item at most once per day)")


def cmd_payments(args: argparse.Namespace) -> None:
    result = features.payments(args.csv_paths)
    print(f"rows read: {result['rows_read']}")
    print(f"total amount: {result['total_amount']}")
    print(f"total units: {result['total_units']}")
    print(f"unit cost: {result['unit_cost']}")


def cmd_mirror(_args: argparse.Namespace) -> None:
    # Verify a redacted copy before anything is pushed -- scans for the
    # same credential shapes the spec-ingest tool refuses to write.
    findings: list[str] = []
    for path in (TASKS, BRIEF, WEEKLY):
        if not path.exists():
            continue
        text = path.read_text(encoding="utf-8")
        for pattern in CREDENTIAL_PATTERNS:
            if pattern.search(text):
                findings.append(f"{path.name}: matches credential shape /{pattern.pattern}/")
    if findings:
        for f in findings:
            print(f"REFUSED: {f}")
        print("mirror refused: redact the above before pushing")
        return
    features.audit_append({"action": "mirror", "result": "clean"})
    print("mirror: no credential shapes found -- clean to push")


def cmd_skill(_args: argparse.Namespace) -> None:
    # Draft a procedure from what repeated three times: normalize each
    # Done-section title and flag any that recur at least 3 times.
    if not TASKS.exists():
        print(NO_TASKS_MESSAGE)
        return
    sections = _split_sections(TASKS.read_text(encoding="utf-8"))
    counts: dict[str, int] = {}
    for line in sections[SECTION_DONE]:
        m = LINE_RE.match(line)
        if not m:
            continue
        _checked, title, _due, _comment = m.groups()
        key = re.sub(r"\s+", " ", title.strip().lower())
        counts[key] = counts.get(key, 0) + 1
    repeated = {k: v for k, v in counts.items() if v >= 3}
    if not repeated:
        print("no task repeated 3+ times yet -- no skill draft to propose")
        return
    for title, count in repeated.items():
        print(f"# Draft skill: {title} (repeated {count} times)")
        print("1. (fill in the steps you took each time)")
        print("2. ...")


def cmd_audit(_args: argparse.Namespace) -> None:
    if not AUDIT_LOG.exists():
        print("no audit log yet")
        return
    print(AUDIT_LOG.read_text(encoding="utf-8"))


def cmd_export(args: argparse.Namespace) -> None:
    out_path = Path(args.path or "store-export.zip")
    with zipfile.ZipFile(out_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for candidate in (TASKS, BRIEF, WEEKLY):
            if candidate.exists():
                zf.write(candidate, candidate.name)
        for dir_candidate in (PEOPLE, SESSIONS, LOG, ROOT / "config"):
            if dir_candidate.exists():
                for f in dir_candidate.rglob("*"):
                    if f.is_file():
                        zf.write(f, f.relative_to(ROOT))
    features.audit_append({"action": "export", "path": str(out_path)})
    print(f"exported store to {out_path}")


def cmd_import(args: argparse.Namespace) -> None:
    in_path = Path(args.path)
    if not in_path.exists():
        print(f"refused: {in_path} does not exist")
        return
    with zipfile.ZipFile(in_path) as zf:
        zf.extractall(ROOT)
    features.audit_append({"action": "import", "path": str(in_path)})
    print(f"imported store from {in_path}")


def cmd_twin(args: argparse.Namespace) -> None:
    # Delegates to the already-implemented parity harness.
    result = subprocess.run(["node", str(ROOT / "tools" / "twinning.mjs"), *args.rest], cwd=ROOT)
    raise SystemExit(result.returncode)


def cmd_ingest(args: argparse.Namespace) -> None:
    # Delegates to the Spec-Ingest Tool's own CLI (cli.mjs at repo root),
    # reusing the readers/corpus/profile logic built there instead of a
    # second implementation.
    result = subprocess.run(["node", str(ROOT / "cli.mjs"), *args.rest], cwd=ROOT)
    raise SystemExit(result.returncode)


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="assistant.py", description="See Exec-Assistant.md")
    sub = p.add_subparsers(dest="command", required=True)

    sub.add_parser("init").set_defaults(func=cmd_init)

    capture_p = sub.add_parser("capture")
    capture_p.add_argument("text")
    capture_p.set_defaults(func=cmd_capture)

    sub.add_parser("file").set_defaults(func=cmd_file)
    sub.add_parser("brief").set_defaults(func=cmd_brief)
    sub.add_parser("site").set_defaults(func=cmd_site)

    event_p = sub.add_parser("event")
    event_p.add_argument("title")
    event_p.add_argument("date")
    event_p.add_argument("--template", default=None)
    event_p.set_defaults(func=cmd_event)

    note_p = sub.add_parser("note")
    note_p.add_argument("title")
    note_p.add_argument("--attendees", default=None)
    note_p.set_defaults(func=cmd_note)

    sub.add_parser("summarize").set_defaults(func=cmd_summarize)

    prep_p = sub.add_parser("prep")
    prep_p.add_argument("people", nargs="*")
    prep_p.set_defaults(func=cmd_prep)

    sub.add_parser("eod").set_defaults(func=cmd_eod)
    sub.add_parser("week").set_defaults(func=cmd_week)
    sub.add_parser("serve").set_defaults(func=cmd_serve)

    why_p = sub.add_parser("why")
    why_p.add_argument("item_id")
    why_p.set_defaults(func=cmd_why)

    anomalies_p = sub.add_parser("anomalies")
    anomalies_p.add_argument("values", nargs="+")
    anomalies_p.set_defaults(func=cmd_anomalies)

    sub.add_parser("remind").set_defaults(func=cmd_remind)

    payments_p = sub.add_parser("payments")
    payments_p.add_argument("csv_paths", nargs="+")
    payments_p.set_defaults(func=cmd_payments)

    sub.add_parser("mirror").set_defaults(func=cmd_mirror)
    sub.add_parser("skill").set_defaults(func=cmd_skill)
    sub.add_parser("audit").set_defaults(func=cmd_audit)

    export_p = sub.add_parser("export")
    export_p.add_argument("path", nargs="?", default=None)
    export_p.set_defaults(func=cmd_export)

    import_p = sub.add_parser("import")
    import_p.add_argument("path")
    import_p.set_defaults(func=cmd_import)

    twin_p = sub.add_parser("twin")
    twin_p.add_argument("rest", nargs="*")
    twin_p.set_defaults(func=cmd_twin)

    ingest_p = sub.add_parser("ingest")
    ingest_p.add_argument("rest", nargs="*")
    ingest_p.set_defaults(func=cmd_ingest)

    return p


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    args.func(args)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))

