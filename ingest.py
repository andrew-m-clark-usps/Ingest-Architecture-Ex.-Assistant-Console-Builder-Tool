"""See Exec-Assistant.md section 7: xlsx via zipfile and a targeted regex
scan (not a full XML/DOM parser -- sidesteps its entity-expansion attack
surface, the same reasoning Spec-Ingest-Tool.md's pptx reader uses), pdf
via zlib streams. Standard library only (invariant 1).
"""
from __future__ import annotations

import re
import zipfile
import zlib
from pathlib import Path

MAX_XLSX_UNCOMPRESSED = 200 * 1024 * 1024  # decompression-bomb defense


def _decode_xml_entities(text: str) -> str:
    return (
        text.replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", '"')
        .replace("&apos;", "'")
        .replace("&amp;", "&")
    )


def _column_letters_to_index(cell_ref: str) -> int:
    letters = "".join(c for c in cell_ref if c.isalpha())
    index = 0
    for ch in letters:
        index = index * 26 + (ord(ch.upper()) - ord("A") + 1)
    return index - 1


def _read_shared_strings(zf: zipfile.ZipFile) -> list[str]:
    if "xl/sharedStrings.xml" not in zf.namelist():
        return []
    shared_xml = zf.read("xl/sharedStrings.xml").decode("utf-8")
    shared_strings: list[str] = []
    # Each <si> may hold multiple <t> runs (rich text) that must be
    # joined -- a run break is formatting, not a text boundary.
    for si_match in re.finditer(r"<si>(.*?)</si>", shared_xml, re.DOTALL):
        texts = re.findall(r"<t[^>]*>(.*?)</t>", si_match.group(1), re.DOTALL)
        shared_strings.append(_decode_xml_entities("".join(texts)))
    return shared_strings


def _read_sheet_xml(zf: zipfile.ZipFile, path: str) -> str:
    sheet_name = next((n for n in zf.namelist() if re.match(r"xl/worksheets/sheet\d+\.xml$", n)), None)
    if sheet_name is None:
        raise ValueError(f"refused: {path} has no xl/worksheets/sheet*.xml part (not a valid .xlsx)")
    return zf.read(sheet_name).decode("utf-8")


def _parse_xlsx_row(row_xml: str, shared_strings: list[str]) -> list[str]:
    cells: dict[int, str] = {}
    for cell_match in re.finditer(r'<c r="([A-Z]+\d+)"([^>]*)>(.*?)</c>', row_xml, re.DOTALL):
        cell_ref, attrs, cell_body = cell_match.groups()
        col_index = _column_letters_to_index(cell_ref)
        value_match = re.search(r"<v>(.*?)</v>", cell_body, re.DOTALL)
        if value_match is None:
            cells[col_index] = ""
            continue
        raw_value = value_match.group(1)
        if 't="s"' in attrs and raw_value.isdigit() and int(raw_value) < len(shared_strings):
            cells[col_index] = shared_strings[int(raw_value)]
        else:
            cells[col_index] = _decode_xml_entities(raw_value)
    width = max(cells.keys(), default=-1) + 1
    return [cells.get(i, "") for i in range(width)]


def read_xlsx(path: str) -> list[list[str]]:
    """Reads the first worksheet of an .xlsx into a list of rows (each a
    list of cell strings). Empty cells are preserved so columns stay
    aligned even when a row skips one."""
    with zipfile.ZipFile(path) as zf:
        total_uncompressed = sum(zi.file_size for zi in zf.infolist())
        if total_uncompressed > MAX_XLSX_UNCOMPRESSED:
            raise ValueError(f"refused: {path} exceeds the {MAX_XLSX_UNCOMPRESSED} byte decompression cap")
        shared_strings = _read_shared_strings(zf)
        sheet_xml = _read_sheet_xml(zf, path)

    return [
        _parse_xlsx_row(row_match.group(1), shared_strings)
        for row_match in re.finditer(r"<row[^>]*>(.*?)</row>", sheet_xml, re.DOTALL)
    ]


def _inflate(raw: bytes) -> bytes:
    try:
        return zlib.decompress(raw)
    except zlib.error:
        return zlib.decompressobj(-15).decompress(raw)


def _resolve_stream(obj_text: str, obj_bytes: bytes) -> bytes | None:
    stream_idx = obj_text.find("stream")
    if stream_idx == -1:
        return None
    data_start = stream_idx + len("stream")
    if obj_bytes[data_start : data_start + 1] == b"\r":
        data_start += 1
    if obj_bytes[data_start : data_start + 1] == b"\n":
        data_start += 1
    end_idx = obj_text.find("endstream", data_start)
    if end_idx == -1:
        raise ValueError("refused: stream has no endstream marker")
    end = end_idx
    if obj_bytes[end - 1 : end] == b"\n":
        end -= 1
        if obj_bytes[end - 1 : end] == b"\r":
            end -= 1
    raw = obj_bytes[data_start:end]
    if "FlateDecode" in obj_text[:stream_idx]:
        return _inflate(raw)
    return raw


TJ_RE = re.compile(r"\((?:\\.|[^\\()])*\)\s*Tj")
TJ_ARRAY_RE = re.compile(r"\[(.*?)\]\s*TJ", re.DOTALL)
LITERAL_STRING_RE = re.compile(r"\((?:\\.|[^\\()])*\)")


def _decode_literal(raw: str) -> str:
    body = raw[1:-1]  # strip surrounding parens
    out: list[str] = []
    i = 0
    escapes = {"n": "\n", "r": "\r", "t": "\t", "b": "\b", "f": "\f"}
    while i < len(body):
        ch = body[i]
        if ch == "\\" and i + 1 < len(body):
            nxt = body[i + 1]
            out.append(escapes.get(nxt, nxt))
            i += 2
        else:
            out.append(ch)
            i += 1
    return "".join(out)


def _extract_lines_from_content(content: str, lines: list[str]) -> None:
    for tj_match in TJ_RE.finditer(content):
        literal = LITERAL_STRING_RE.search(tj_match.group(0))
        if literal:
            decoded = _decode_literal(literal.group(0))
            if decoded.strip():
                lines.append(decoded)
    for arr_match in TJ_ARRAY_RE.finditer(content):
        joined = "".join(_decode_literal(m.group(0)) for m in LITERAL_STRING_RE.finditer(arr_match.group(1)))
        if joined.strip():
            lines.append(joined)


def read_pdf(path: str) -> list[str]:
    """Text-only PDF reader: BT/ET text-showing operators (Tj/TJ) with
    FlateDecode stream support. This is a lighter-weight companion to the
    full CMap-aware reader in Spec-Ingest-Tool.md's src/pdfText.ts (object
    streams, /ToUnicode CMaps, glyph-position line reconstruction) --
    character codes here fall back to a direct byte value, exact for plain
    ASCII content and approximate otherwise."""
    data = Path(path).read_bytes()
    text = data.decode("latin-1")

    lines: list[str] = []
    for obj_match in re.finditer(r"\d+\s+\d+\s+obj\b(.*?)endobj", text, re.DOTALL):
        obj_text = obj_match.group(1)
        if "stream" not in obj_text:
            continue
        obj_bytes = data[obj_match.start(1) : obj_match.end(1)]
        stream = _resolve_stream(obj_text, obj_bytes)
        if stream is None:
            continue
        content = stream.decode("latin-1", errors="replace")
        _extract_lines_from_content(content, lines)
    return lines
