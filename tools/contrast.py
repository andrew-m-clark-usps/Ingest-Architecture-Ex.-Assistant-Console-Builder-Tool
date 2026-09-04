#!/usr/bin/env python3
"""Contrast checker for the assistant's CSS custom properties.

See Exec-Assistant.md section 5: `rule` (the hairline divider) is
deliberately NOT contrast-checked -- forcing it to 3:1 against the
background produces banded, unreadable tables in dark mode. Every other
named color token is checked: 4.5:1 for signal colours (regular text/
foreground tokens), 3:1 for `rule-strong` (an emphasized divider).

Standard library only.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets"

# Token name -> required contrast ratio against --bg. `rule` is
# intentionally absent from this table -- see the module docstring.
REQUIRED_RATIOS = {
    "fg": 4.5,
    "muted": 4.5,
    "accent": 4.5,
    "rule-strong": 3.0,
}

NEVER_CHECKED = {"rule"}


def _hex_to_rgb(hex_color: str) -> tuple[int, int, int]:
    hex_color = hex_color.lstrip("#")
    if len(hex_color) == 3:
        hex_color = "".join(c * 2 for c in hex_color)
    r, g, b = (int(hex_color[i : i + 2], 16) for i in (0, 2, 4))
    return r, g, b


def _relative_luminance(rgb: tuple[int, int, int]) -> float:
    def channel(c: int) -> float:
        c_norm = c / 255
        return c_norm / 12.92 if c_norm <= 0.03928 else ((c_norm + 0.055) / 1.055) ** 2.4

    r, g, b = rgb
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)


def contrast_ratio(hex_a: str, hex_b: str) -> float:
    """WCAG 2.x contrast ratio between two hex colors, in [1, 21]."""
    la = _relative_luminance(_hex_to_rgb(hex_a))
    lb = _relative_luminance(_hex_to_rgb(hex_b))
    lighter, darker = max(la, lb), min(la, lb)
    return (lighter + 0.05) / (darker + 0.05)


def parse_css_variables(css_text: str) -> dict[str, str]:
    return dict(re.findall(r"--([\w-]+)\s*:\s*(#[0-9a-fA-F]{3,6})\s*;", css_text))


def check(assets_dir: Path = ASSETS) -> list[str]:
    """Returns a list of failure messages; empty means every checked token
    meets its required ratio."""
    variables: dict[str, str] = {}
    for css_file in sorted(assets_dir.glob("*.css")):
        variables.update(parse_css_variables(css_file.read_text(encoding="utf-8")))

    bg = variables.get("bg")
    if not bg:
        return ["no --bg token found in assets/*.css -- cannot compute contrast"]

    failures: list[str] = []
    for token, required in REQUIRED_RATIOS.items():
        if token not in variables:
            continue
        ratio = contrast_ratio(variables[token], bg)
        if ratio < required:
            failures.append(f"--{token} ({variables[token]}) against --bg ({bg}) is {ratio:.2f}:1, needs {required}:1")

    for skipped in NEVER_CHECKED & variables.keys():
        print(f"--{skipped} intentionally not contrast-checked (see Exec-Assistant.md section 5)")

    return failures


def main() -> int:
    failures = check()
    if failures:
        for f in failures:
            print(f"FAIL: {f}")
        return 1
    print("all checked color tokens meet their required contrast ratio")
    return 0


if __name__ == "__main__":
    sys.exit(main())
