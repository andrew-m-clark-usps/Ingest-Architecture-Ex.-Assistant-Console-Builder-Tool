#!/usr/bin/env python3
"""MCP server: six tools over stdio, no SDK, read-only except capture. See
Exec-Assistant.md section 7.
"""
import json
import sys
import uuid
from datetime import datetime

import assistant
import features

TOOLS = [
    {"name": "capture", "description": "Write one capture file (the only tool that writes)."},
    {"name": "why", "description": "Explain the chain for an item id."},
    {"name": "prep", "description": "What you owe/are owed for a person."},
    {"name": "anomalies", "description": "Median/MAD anomaly scores for a signal."},
    {"name": "payments", "description": "Usage and unit cost from payments/*.csv."},
    {"name": "list_profiles", "description": "List available profiles."},
]


def _respond(msg_id, result) -> None:
    sys.stdout.write(json.dumps({"jsonrpc": "2.0", "id": msg_id, "result": result}) + "\n")
    sys.stdout.flush()


def _tool_result(text: str, is_error: bool = False) -> dict:
    return {"content": [{"type": "text", "text": text}], "isError": is_error}


def _call_capture(args: dict) -> dict:
    text = args.get("text")
    if not text:
        return _tool_result('capture requires "text"', is_error=True)
    assistant.INBOX.mkdir(parents=True, exist_ok=True)
    capture_id = uuid.uuid4().hex[:6]
    now = datetime.now().astimezone().isoformat(timespec="seconds")
    path = assistant.INBOX / f"{capture_id}.md"
    # The MCP capture tool writes exactly one file and runs no git
    # (invariant 9) -- this is the only tool in this server that writes.
    path.write_text(
        f"---\ncaptured: {now}\nid: {capture_id}\nsource: mcp\nstatus: unresolved\n---\n{text}\n",
        encoding="utf-8",
    )
    return _tool_result(json.dumps({"path": str(path), "id": capture_id}))


def _call_why(args: dict) -> dict:
    item_id = args.get("item_id")
    if not item_id or not assistant.TASKS.exists():
        return _tool_result("no matching item", is_error=True)
    sections = assistant._split_sections(assistant.TASKS.read_text(encoding="utf-8"))
    for header in assistant.SECTION_HEADERS:
        for line in sections[header]:
            m = assistant.LINE_RE.match(line)
            if not m:
                continue
            _checked, title, due, comment = m.groups()
            found_id, captured, fields = assistant._parse_comment_fields(comment)
            if found_id == item_id:
                return _tool_result(
                    json.dumps(
                        {
                            "captured": captured,
                            "section": header,
                            "classified_as_task": assistant.is_task(title),
                            "due": due,
                            "rolled": fields.get("rolled", "0"),
                        }
                    )
                )
    return _tool_result(f"no item found with id {item_id}", is_error=True)


def _call_prep(args: dict) -> dict:
    person = args.get("person")
    if not person or not assistant.TASKS.exists():
        return _tool_result('prep requires "person"', is_error=True)
    lowered = person.lower()
    sections = assistant._split_sections(assistant.TASKS.read_text(encoding="utf-8"))
    return _tool_result(
        json.dumps(
            {
                "you_owe_them": [line for line in sections["## I owe"] if lowered in line.lower()],
                "they_owe_you": [line for line in sections["## Waiting on"] if lowered in line.lower()],
            }
        )
    )


def _call_anomalies(args: dict) -> dict:
    signal = args.get("signal")
    if not isinstance(signal, list):
        return _tool_result('anomalies requires "signal" (array of numbers)', is_error=True)
    return _tool_result(json.dumps(features.anomalies([float(x) for x in signal])))


def _call_payments(args: dict) -> dict:
    csv_paths = args.get("csv_paths")
    if not isinstance(csv_paths, list):
        return _tool_result('payments requires "csv_paths" (array)', is_error=True)
    result = features.payments(csv_paths)
    return _tool_result(json.dumps({k: str(v) for k, v in result.items()}))


def _call_list_profiles(_args: dict) -> dict:
    return _tool_result(json.dumps({"profiles": [{"id": "generic", "name": "Generic application brief"}]}))


DISPATCH = {
    "capture": _call_capture,
    "why": _call_why,
    "prep": _call_prep,
    "anomalies": _call_anomalies,
    "payments": _call_payments,
    "list_profiles": _call_list_profiles,
}


def main() -> None:
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            msg = json.loads(line)
        except json.JSONDecodeError:
            continue
        method = msg.get("method")
        if method == "initialize":
            _respond(
                msg["id"],
                {
                    "protocolVersion": "2024-11-05",
                    "capabilities": {"tools": {}},
                    "serverInfo": {"name": "assistant", "version": "0.2.0"},
                },
            )
        elif method == "tools/list":
            _respond(msg["id"], {"tools": TOOLS})
        elif method == "tools/call":
            params = msg.get("params", {})
            name = params.get("name")
            call_args = params.get("arguments") or {}
            handler = DISPATCH.get(name)
            if handler is None:
                _respond(msg["id"], _tool_result(f"unknown tool: {name}", is_error=True))
            else:
                try:
                    _respond(msg["id"], handler(call_args))
                except Exception as exc:  # refuse, don't crash the server
                    _respond(msg["id"], _tool_result(str(exc), is_error=True))
        # notifications/initialized needs no response


if __name__ == "__main__":
    main()
