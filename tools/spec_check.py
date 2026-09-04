#!/usr/bin/env python3
"""Verifies assistant.py's command dispatch and Exec-Assistant.md's core
file map both stay intact. This is a regression guard for CI, not a
design tool: it checks the code against a list of names/paths the brief
names, so a future edit that accidentally drops a command or a file from
this build is caught immediately. See Exec-Assistant.md section 6
(commands) and section 7 (file map).

Standard library only.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# Every command named in Exec-Assistant.md section 6.
REQUIRED_COMMANDS = [
    "init", "capture", "file", "brief", "site", "event", "note", "summarize",
    "prep", "eod", "week", "serve", "why", "anomalies", "remind", "payments",
    "mirror", "skill", "audit", "export", "import", "twin", "ingest",
]

# The core files named in Exec-Assistant.md section 7.
REQUIRED_FILES = [
    "assistant.py", "features.py", "ingest.py", "mcp_server.py", "test_core.py",
    "assets/night.css", "assets/topnav.css", "assets/widgets.css", "assets/app.css",
    "dashboard/dashboard.py", "dashboard/rbac.md", "dashboard/sample.json",
    "tools/twinning.mjs", "tools/twinning_mcp.mjs", "console/src/DashboardCore.tsx",
]


def find_declared_commands(assistant_source: str) -> set[str]:
    return set(re.findall(r'sub\.add_parser\(\s*"([\w-]+)"', assistant_source))


def check_commands() -> list[str]:
    source = (ROOT / "assistant.py").read_text(encoding="utf-8")
    declared = find_declared_commands(source)
    return [
        f"command '{cmd}' from Exec-Assistant.md section 6 is missing from assistant.py's dispatch"
        for cmd in REQUIRED_COMMANDS
        if cmd not in declared
    ]


def check_files() -> list[str]:
    return [
        f"file-map entry '{rel}' (Exec-Assistant.md section 7) does not exist on disk"
        for rel in REQUIRED_FILES
        if not (ROOT / rel).exists()
    ]


def main() -> int:
    failures = check_commands() + check_files()
    if failures:
        for f in failures:
            print(f"FAIL: {f}")
        return 1
    print(f"all {len(REQUIRED_COMMANDS)} commands and {len(REQUIRED_FILES)} file-map entries verified")
    return 0


if __name__ == "__main__":
    sys.exit(main())
