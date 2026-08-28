import type { Candidate } from './profiles/types.js'
import { readZipEntries } from './unzip.js'

// See ../Spec-Ingest-Tool.md section 5A ("Reading a spreadsheet"). An
// .xlsx is a ZIP of XML — the same machinery that reads a .pptx. Three
// parts matter: workbook.xml (sheet names), sharedStrings.xml (most cell
// text lives here, not inline), and worksheets/sheetN.xml (cells keyed by
// their `r` attribute, e.g. B4 — never by element order, since empty
// cells are simply absent).

export interface SheetRow {
  rowNumber: number
  cells: Record<string, string>
}

export interface SheetData {
  name: string
  headers: string[]
  rows: SheetRow[]
}

function columnLetters(cellRef: string): string {
  return (/^[A-Z]+/.exec(cellRef) ?? [''])[0]
}

function rowNumberOf(cellRef: string): number {
  return Number((/\d+$/.exec(cellRef) ?? ['0'])[0])
}

function columnIndex(letters: string): number {
  let index = 0
  for (const ch of letters) index = index * 26 + (ch.charCodeAt(0) - 64)
  return index
}

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
}

function parseSharedStrings(xml: string | undefined): string[] {
  if (!xml) return []
  // Each <si> may hold one <t> or several <r><t> rich-text runs — join them.
  const strings: string[] = []
  const siRe = /<si>([\s\S]*?)<\/si>/g
  const tRe = /<t[^>]*>([\s\S]*?)<\/t>/g
  let siMatch: RegExpExecArray | null
  while ((siMatch = siRe.exec(xml)) !== null) {
    let joined = ''
    tRe.lastIndex = 0
    let tMatch: RegExpExecArray | null
    while ((tMatch = tRe.exec(siMatch[1])) !== null) joined += decodeXmlEntities(tMatch[1])
    strings.push(joined)
  }
  return strings
}

function parseSheetName(workbookXml: string | undefined, sheetFileName: string): string {
  if (!workbookXml) return sheetFileName
  const sheetNumMatch = /sheet(\d+)\.xml$/.exec(sheetFileName)
  if (!sheetNumMatch) return sheetFileName
  const sheets = [...workbookXml.matchAll(/<sheet\b[^>]*name="([^"]*)"[^>]*\/>/g)]
  const index = Number(sheetNumMatch[1]) - 1
  return sheets[index]?.[1] ?? sheetFileName
}

/** Parse one worksheet XML into rows keyed by column letters, merged-cell values carried across their range. */
function parseSheetXml(xml: string, sharedStrings: string[]): SheetRow[] {
  const rows: SheetRow[] = []

  // A merged cell holds its value only in the top-left of the range —
  // carry it across so rows beneath/beside it don't lose their category.
  const mergedRanges = [...xml.matchAll(/<mergeCell\s+ref="([A-Z]+\d+):([A-Z]+\d+)"\s*\/>/g)]

  const rowRe = /<row\s+r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g
  const cellRe = /<c\s+r="([A-Z]+\d+)"([^>]*)>(?:([\s\S]*?))?<\/c>|<c\s+r="([A-Z]+\d+)"([^>]*)\/>/g

  let rowMatch: RegExpExecArray | null
  while ((rowMatch = rowRe.exec(xml)) !== null) {
    const rowNumber = Number(rowMatch[1])
    const cells: Record<string, string> = {}
    cellRe.lastIndex = 0
    let cellMatch: RegExpExecArray | null
    while ((cellMatch = cellRe.exec(rowMatch[2])) !== null) {
      const ref = cellMatch[1] ?? cellMatch[4]
      const attrs = cellMatch[2] ?? cellMatch[5] ?? ''
      const inner = cellMatch[3] ?? ''
      const col = columnLetters(ref)
      const typeMatch = /\bt="([^"]+)"/.exec(attrs)
      const type = typeMatch?.[1]
      const vMatch = /<v>([\s\S]*?)<\/v>/.exec(inner)
      const raw = vMatch?.[1] ?? ''
      if (type === 's') {
        const idx = Number(raw)
        cells[col] = sharedStrings[idx] ?? ''
      } else if (type === 'str' || type === 'inlineStr') {
        const isMatch = /<t[^>]*>([\s\S]*?)<\/t>/.exec(inner)
        cells[col] = decodeXmlEntities(isMatch?.[1] ?? raw)
      } else {
        // Numeric (including a formula's cached <v>) or boolean — read the
        // cache, never evaluate. A stale cache is a contradiction for
        // section 9a to find, not something to silently recompute.
        cells[col] = raw
      }
    }
    rows.push({ rowNumber, cells })
  }

  // Carry merged-cell values across their declared range.
  for (const [, topLeft, bottomRight] of mergedRanges) {
    const sourceRow = rows.find((r) => r.rowNumber === rowNumberOf(topLeft))
    const value = sourceRow?.cells[columnLetters(topLeft)]
    if (value === undefined) continue
    const startCol = columnIndex(columnLetters(topLeft))
    const endCol = columnIndex(columnLetters(bottomRight))
    const startRow = rowNumberOf(topLeft)
    const endRow = rowNumberOf(bottomRight)
    for (const row of rows) {
      if (row.rowNumber < startRow || row.rowNumber > endRow) continue
      for (let c = startCol; c <= endCol; c++) {
        const letters = String.fromCharCode(64 + c) // single-letter columns only, A-Z
        if (row.cells[letters] === undefined || row.cells[letters] === '') row.cells[letters] = value
      }
    }
  }

  return rows
}

export async function readXlsx(bytes: Uint8Array): Promise<SheetData[]> {
  const entries = await readZipEntries(bytes)
  const decoder = new TextDecoder('utf-8')
  const byName = new Map(entries.map((e) => [e.name, decoder.decode(e.data)]))

  const workbookXml = byName.get('xl/workbook.xml')
  const sharedStrings = parseSharedStrings(byName.get('xl/sharedStrings.xml'))

  const sheetFiles = [...byName.keys()]
    .filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n))
    .sort((a, b) => {
      const na = Number(/sheet(\d+)\.xml$/.exec(a)![1])
      const nb = Number(/sheet(\d+)\.xml$/.exec(b)![1])
      return na - nb
    })

  if (sheetFiles.length === 0) {
    throw new Error('no xl/worksheets/sheetN.xml entries found — is this an .xlsx file? (demo scaffold reader)')
  }

  return sheetFiles.map((file) => {
    const rows = parseSheetXml(byName.get(file)!, sharedStrings)
    // A header row is a guess, not a fact: take the first non-empty row.
    const headerRow = rows.find((r) => Object.values(r.cells).some((v) => v.trim().length > 0))
    const headers = headerRow ? Object.values(headerRow.cells) : []
    return { name: parseSheetName(workbookXml, file), headers, rows }
  })
}

/** Classify spreadsheet rows into candidates: a two-column old/new-name sheet is the highest-value input the tool gets. */
export function classifySpreadsheet(sheet: SheetData, ref: string): Candidate[] {
  const candidates: Candidate[] = []
  if (sheet.rows.length < 2) return candidates

  const headerRow = sheet.rows[0]
  const dataRows = sheet.rows.slice(1)
  const columns = Object.keys(headerRow.cells).sort()

  // A two-column old-name/new-name mapping is the highest-value shape.
  if (columns.length === 2) {
    const [oldCol, newCol] = columns
    const oldHeader = headerRow.cells[oldCol]?.toLowerCase() ?? ''
    const newHeader = headerRow.cells[newCol]?.toLowerCase() ?? ''
    const looksLikeMapping = /old|legacy|current|from/.test(oldHeader) || /new|target|to/.test(newHeader)
    if (looksLikeMapping) {
      for (const row of dataRows) {
        const oldVal = row.cells[oldCol]
        const newVal = row.cells[newCol]
        if (!oldVal && !newVal) continue
        candidates.push({
          kind: 'field',
          text: `${oldVal ?? '(unmapped)'} -> ${newVal ?? '(unmapped)'}`,
          ref: `${ref}#${sheet.name}!row${row.rowNumber}`,
          because: 'two-column old-name/new-name mapping',
        })
      }
      return candidates
    }
  }

  // Otherwise: one field candidate per header, a record candidate per row.
  for (const col of columns) {
    const header = headerRow.cells[col]
    if (header) {
      candidates.push({
        kind: 'field',
        text: header,
        ref: `${ref}#${sheet.name}!${col}1`,
        because: 'spreadsheet column header',
      })
    }
  }
  for (const row of dataRows) {
    const values = columns.map((c) => row.cells[c]).filter(Boolean)
    if (values.length === 0) continue
    candidates.push({
      kind: 'record',
      text: values.join(' | '),
      ref: `${ref}#${sheet.name}!row${row.rowNumber}`,
      because: 'spreadsheet data row',
    })
  }
  return candidates
}
