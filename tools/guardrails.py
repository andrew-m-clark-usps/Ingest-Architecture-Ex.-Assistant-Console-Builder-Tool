#!/usr/bin/env python3
"""Guardrail checks shared by CI: no model-provider SDK, stdlib-only
imports outside tools/, and no <script>/on*/<style> in rendered output.
See Exec-Assistant.md invariants 1 and 6, and the same security posture
Spec-Ingest-Tool.md section 3 states for that product.

Standard library only.
"""
from __future__ import annotations

import ast
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# Files this build ships outside tools/ -- these must import the standard
# library, or each other, and nothing else.
STDLIB_ONLY_FILES = [
    "assistant.py",
    "features.py",
    "ingest.py",
    "mcp_server.py",
    "test_core.py",
    "dashboard/dashboard.py",
]

# First-party modules the files above are allowed to import from each
# other (including test-time imports of this project's own tools/ and
# dashboard/ scripts) -- "standard library only" bans third-party
# packages, not this project's own other files.
FIRST_PARTY_MODULES = {
    "assistant",
    "features",
    "ingest",
    "mcp_server",
    "dashboard",
    "contrast",
    "spec_check",
    "guardrails",
}

# Known model-provider SDK name fragments -- same denylist idea as
# src/noModelProvider.test.ts on the Ingest side of this repo.
BANNED_PACKAGE_FRAGMENTS = ["openai", "anthropic", "generativeai", "cohere", "langchain", "huggingface", "ollama"]

FORBIDDEN_HTML_PATTERNS = [
    (re.compile(r"<script\b", re.IGNORECASE), "<script> tag"),
    (re.compile(r"\bon[a-z]+\s*=", re.IGNORECASE), "on* attribute"),
    (re.compile(r"<style\b", re.IGNORECASE), "<style> block/attribute"),
]


def _top_level_imports(source: str) -> set[str]:
    tree = ast.parse(source)
    names: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                names.add(alias.name.split(".")[0])
        elif isinstance(node, ast.ImportFrom):
            if node.module and node.level == 0:
                names.add(node.module.split(".")[0])
    return names


def check_stdlib_only(files: list[str] = STDLIB_ONLY_FILES) -> list[str]:
    failures: list[str] = []
    stdlib = set(sys.stdlib_module_names)
    for rel in files:
        path = ROOT / rel
        if not path.exists():
            failures.append(f"{rel}: file does not exist")
            continue
        for name in _top_level_imports(path.read_text(encoding="utf-8")):
            if name == "__future__" or name in stdlib or name in FIRST_PARTY_MODULES:
                continue
            failures.append(f"{rel}: imports non-stdlib, non-first-party module '{name}'")
    return failures


def check_no_model_provider_sdk() -> list[str]:
    failures: list[str] = []
    for path in sorted(ROOT.glob("*.py")) + sorted((ROOT / "dashboard").glob("*.py")):
        text = path.read_text(encoding="utf-8", errors="ignore").lower()
        for fragment in BANNED_PACKAGE_FRAGMENTS:
            if fragment in text:
                failures.append(f"{path.relative_to(ROOT)}: mentions banned fragment '{fragment}'")
    return failures


def check_no_script_in_html(html_paths: list[Path]) -> list[str]:
    failures: list[str] = []
    for path in html_paths:
        text = path.read_text(encoding="utf-8")
        for pattern, label in FORBIDDEN_HTML_PATTERNS:
            if pattern.search(text):
                failures.append(f"{path}: contains a {label}")
    return failures


def main() -> int:
    failures = check_stdlib_only() + check_no_model_provider_sdk()
    if failures:
        for f in failures:
            print(f"FAIL: {f}")
        return 1
    print("guardrails: stdlib-only imports and no-model-provider-SDK checks passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
