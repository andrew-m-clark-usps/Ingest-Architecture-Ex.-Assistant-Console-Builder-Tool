"""See Exec-Assistant.md section 12: reads dashboard/sample.json and
writes 5 static pages (overview, records, feeds, charges, activity). Same
dark theme and widget CSS, no script -- invariants 6 and 7.
"""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SAMPLE = ROOT / "sample.json"
OUT_DIR = ROOT / "site"

NAV_PAGES = ["overview", "records", "feeds", "charges", "activity"]


def _load_sample(sample_path: Path = SAMPLE) -> dict:
    if not sample_path.exists():
        return {"records": [], "feeds": [], "charges": [], "activity": []}
    return json.loads(sample_path.read_text(encoding="utf-8"))


def _nav_html(current: str) -> str:
    links = []
    for page in NAV_PAGES:
        label = page.capitalize()
        if page == current:
            links.append(f"<span aria-current='page'>{label}</span>")
        else:
            links.append(f"<a href='{page}.html'>{label}</a>")
    return "<nav class='topnav'>" + " | ".join(links) + "</nav>"


def _page_html(title: str, current: str, body: str) -> str:
    # No <script>, no on* attribute, no <style> block/attribute
    # (invariant 6). Dark theme only, linked -- never inline (invariant 7).
    return (
        "<!doctype html><html><head><meta charset='utf-8'>"
        "<link rel='stylesheet' href='../../assets/night.css'>"
        "<link rel='stylesheet' href='../../assets/topnav.css'>"
        "<link rel='stylesheet' href='../../assets/widgets.css'>"
        f"<title>{title}</title></head><body>"
        f"{_nav_html(current)}<h1>{title}</h1>{body}</body></html>"
    )


def _table(rows: list[dict], columns: list[str]) -> str:
    if not rows:
        return "<p>No data.</p>"
    header = "".join(f"<th>{c}</th>" for c in columns)
    body_rows = "".join("<tr>" + "".join(f"<td>{row.get(c, '')}</td>" for c in columns) + "</tr>" for row in rows)
    return f"<table><thead><tr>{header}</tr></thead><tbody>{body_rows}</tbody></table>"


def build(out_dir: Path = OUT_DIR, sample_path: Path = SAMPLE) -> list[Path]:
    data = _load_sample(sample_path)
    out_dir.mkdir(parents=True, exist_ok=True)

    overview_body = "".join(
        f"<div class='widget'>{name}: {len(data.get(name, []))}</div>"
        for name in ("records", "feeds", "charges", "activity")
    )
    pages = {"overview": overview_body}
    for name in ("records", "feeds", "charges", "activity"):
        rows = data.get(name, [])
        columns = sorted({key for row in rows for key in row})
        pages[name] = _table(rows, columns)

    written: list[Path] = []
    for page, body in pages.items():
        path = out_dir / f"{page}.html"
        path.write_text(_page_html(page.capitalize(), page, body), encoding="utf-8")
        written.append(path)
    return written


def main() -> None:
    for path in build():
        print(f"wrote {path}")


if __name__ == "__main__":
    main()
