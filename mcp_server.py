#!/usr/bin/env python3
"""DEMO/REFERENCE SCAFFOLD MCP server. See Exec-Assistant.md section 7: six
tools over stdio, no SDK, read only except capture.
"""
import json
import sys

TOOLS = [
    {"name": "capture", "description": "Write one capture file (scaffold: not implemented)."},
    {"name": "why", "description": "Explain the chain for an item id (scaffold: not implemented)."},
    {"name": "prep", "description": "What you owe/are owed for a person (scaffold: not implemented)."},
    {"name": "anomalies", "description": "Median/MAD anomaly signals (scaffold: not implemented)."},
    {"name": "payments", "description": "Usage and unit cost (scaffold: not implemented)."},
    {"name": "list_profiles", "description": "List available profiles (scaffold: not implemented)."},
]


def _respond(msg_id, result) -> None:
    sys.stdout.write(json.dumps({"jsonrpc": "2.0", "id": msg_id, "result": result}) + "\n")
    sys.stdout.flush()


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
                    "serverInfo": {"name": "assistant-scaffold", "version": "0.1.0-demo"},
                },
            )
        elif method == "tools/list":
            _respond(msg["id"], {"tools": TOOLS})
        elif method == "tools/call":
            _respond(
                msg["id"],
                {
                    "content": [{"type": "text", "text": "DEMO SCAFFOLD: not implemented. See Exec-Assistant.md."}],
                    "isError": True,
                },
            )
        # notifications/initialized needs no response


if __name__ == "__main__":
    main()
