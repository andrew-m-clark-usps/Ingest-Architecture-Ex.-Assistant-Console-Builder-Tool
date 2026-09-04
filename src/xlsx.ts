import { readZipEntries } from './unzip.js'
import { classifyLines } from './specExtract.js'
import type { Candidate } from './profiles/types.js'

export interface SpreadsheetCell {
  ref: string
  value: string
  computed: boolean
}

export interface SpreadsheetRow {
  row: number
  cells: SpreadsheetCell[]
}

export interface SpreadsheetSheet {
  name: string
  rows: SpreadsheetRow[]
  headerRow: number | undefined
}

const XML_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
}

function decodeXmlEntities(text: string): string {
  return text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity: string) => {
    if (entity.startsWith('#')) {
      const isHex = entity[1] === 'x' || entity[1] === 'X'
      const code = isHex ? Number.parseInt(entity.slice(2), 16) : Number.parseInt(entity.slice(1), 10)
      return Number.isFinite(code) ? String.fromCodePoint(code) : match
    }
    return XML_ENTITIES[entity.toLowerCase()] ?? match
  })
}

function columnLettersToIndex(letters: string): number {
  let value = 0
  for (const ch of letters.toUpperCase()) {
    value = value * 26 + ((ch.codePointAt(0) ?? 64) - 64)
  }
  return value - 1
}

function indexToColumnLetters(index: number): string {
  let current = index + 1
  let out = ''
  while (current > 0) {
    const remainder = (current - 1) % 26
    out = String.fromCodePoint(65 + remainder) + out
    current = Math.floor((current - 1) / 26)
  }
  return out
}

function parseCellRef(ref: string): { col: number; row: number } {
  const match = /^([A-Z]+)(\d+)$/i.exec(ref)
  if (!match) throw new Error(`refused: unsupported spreadsheet cell reference "${ref}"`)
  return { col: columnLettersToIndex(match[1]), row: Number.parseInt(match[2], 10) }
}

function compareByNumber(a: number, b: number): number {
  return a - b
}

function compareByText(a: string, b: string): number {
  return a.localeCompare(b)
}

function extractSharedStringText(siXml: string): string {
  const runs = [...siXml.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((match) => decodeXmlEntities(match[1]))
  return runs.join('')
}

function parseSharedStrings(xml: string | undefined): string[] {
  if (!xml) return []
  return [...xml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((match) => extractSharedStringText(match[1]))
}

function parseWorkbookSheets(xml: string): Array<{ name: string; relId: string }> {
  return [...xml.matchAll(/<sheet\b[^>]*name="([^"]+)"[^>]*r:id="([^"]+)"[^>]*\/?>/g)].map((match) => ({
    name: decodeXmlEntities(match[1]),
    relId: match[2],
  }))
}

function parseWorkbookRels(xml: string | undefined): Map<string, string> {
  const rels = new Map<string, string>()
  if (!xml) return rels
  for (const match of xml.matchAll(/<Relationship\b[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"[^>]*\/?>/g)) {
    rels.set(match[1], match[2].replace(/^\//, ''))
  }
  return rels
}

function parseInlineString(xml: string): string {
  const text = [...xml.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((match) => decodeXmlEntities(match[1])).join('')
  return text
}

function parseCellValue(type: string | undefined, cellXml: string, sharedStrings: string[]): { value: string; computed: boolean } {
  const valueMatch = /<v>([\s\S]*?)<\/v>/.exec(cellXml)
  const valueText = valueMatch ? decodeXmlEntities(valueMatch[1]) : ''
  const computed = /<f(?:\s|>)/.test(cellXml) && valueMatch !== null

  if (type === 's') {
    const idx = Number.parseInt(valueText, 10)
    return { value: Number.isFinite(idx) ? (sharedStrings[idx] ?? valueText) : valueText, computed }
  }
  if (type === 'inlineStr') {
    return { value: parseInlineString(cellXml), computed }
  }
  if (type === 'b') {
    return { value: valueText === '1' ? 'TRUE' : 'FALSE', computed }
  }
  return { value: valueText, computed }
}

function parseMergedRanges(xml: string): Array<{ startCol: number; startRow: number; endCol: number; endRow: number }> {
  const ranges: Array<{ startCol: number; startRow: number; endCol: number; endRow: number }> = []
  for (const match of xml.matchAll(/<mergeCell\b[^>]*ref="([A-Z]+\d+):([A-Z]+\d+)"[^>]*\/?>/g)) {
    const start = parseCellRef(match[1])
    const end = parseCellRef(match[2])
    ranges.push({ startCol: start.col, startRow: start.row, endCol: end.col, endRow: end.row })
  }
  return ranges
}

function ensureRow(rows: Map<number, Map<number, SpreadsheetCell>>, rowNum: number): Map<number, SpreadsheetCell> {
  const existing = rows.get(rowNum)
  if (existing) return existing
  const created = new Map<number, SpreadsheetCell>()
  rows.set(rowNum, created)
  return created
}

function applyMergedRanges(rows: Map<number, Map<number, SpreadsheetCell>>, mergedRanges: Array<{ startCol: number; startRow: number; endCol: number; endRow: number }>): void {
  for (const range of mergedRanges) {
    const topLeft = rows.get(range.startRow)?.get(range.startCol)
    if (!topLeft || topLeft.value.length === 0) continue
    for (let row = range.startRow; row <= range.endRow; row++) {
      const rowCells = ensureRow(rows, row)
      for (let col = range.startCol; col <= range.endCol; col++) {
        if (!rowCells.has(col)) {
          rowCells.set(col, {
            ref: `${indexToColumnLetters(col)}${row}`,
            value: topLeft.value,
            computed: topLeft.computed,
          })
        }
      }
    }
  }
}

function materializeRows(rowMap: Map<number, Map<number, SpreadsheetCell>>): SpreadsheetRow[] {
  return [...rowMap.keys()].sort(compareByNumber).map((rowNum) => {
    const byColumn = rowMap.get(rowNum) ?? new Map<number, SpreadsheetCell>()
    const maxCol = byColumn.size === 0 ? -1 : Math.max(...byColumn.keys())
    const cells: SpreadsheetCell[] = []
    for (let col = 0; col <= maxCol; col++) {
      cells.push(
        byColumn.get(col) ?? {
          ref: `${indexToColumnLetters(col)}${rowNum}`,
          value: '',
          computed: false,
        },
      )
    }
    return { row: rowNum, cells }
  })
}

function parseWorksheet(name: string, xml: string, sharedStrings: string[]): SpreadsheetSheet {
  const rowMap = new Map<number, Map<number, SpreadsheetCell>>()

  for (const rowMatch of xml.matchAll(/<row\b[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)) {
    const rowNum = Number.parseInt(rowMatch[1], 10)
    const rowCells = ensureRow(rowMap, rowNum)
    for (const cellMatch of rowMatch[2].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)) {
      const attrs = cellMatch[1]
      const refMatch = /\br="([A-Z]+\d+)"/i.exec(attrs)
      if (!refMatch) continue
      const typeMatch = /\bt="([^"]+)"/.exec(attrs)
      const { col } = parseCellRef(refMatch[1])
      const parsed = parseCellValue(typeMatch?.[1], cellMatch[2], sharedStrings)
      rowCells.set(col, { ref: refMatch[1], value: parsed.value, computed: parsed.computed })
    }
  }

  applyMergedRanges(rowMap, parseMergedRanges(xml))
  const rows = materializeRows(rowMap)
  const headerRow = rows.find((row) => row.cells.some((cell) => cell.value.trim().length > 0))?.row
  return { name, rows, headerRow }
}

function trimmedRowValues(row: SpreadsheetRow): string[] {
  const values = row.cells.map((cell) => cell.value)
  let end = values.length
  while (end > 0 && values[end - 1].trim().length === 0) end--
  return values.slice(0, end)
}

function sameRowValues(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false
  }
  return true
}

function normalizeSheetTarget(target: string | undefined): string | undefined {
  if (!target) return undefined
  if (target.startsWith('xl/')) return target
  return `xl/${target.replace(/^\.\//, '')}`
}

function appendHeaderCandidates(candidates: Candidate[], header: SpreadsheetRow | undefined, refBase: string, sheetName: string): string[] {
  const headerValues = header ? trimmedRowValues(header) : []
  if (!header) return headerValues

  for (const cell of header.cells) {
    if (cell.value.trim().length === 0) continue
    candidates.push({
      kind: 'field',
      text: cell.value,
      ref: `${refBase}#${sheetName}!${cell.ref}`,
      because: 'spreadsheet header cell (first non-empty row)',
    })
  }
  return headerValues
}

function appendRowCandidates(candidates: Candidate[], row: SpreadsheetRow, headerRow: number | undefined, headerValues: string[], refBase: string, sheetName: string): void {
  if (row.row === headerRow) return

  const rowValues = trimmedRowValues(row)
  if (rowValues.length === 0) return
  if (headerValues.length > 0 && sameRowValues(rowValues, headerValues)) return

  candidates.push({
    kind: 'record',
    text: rowValues.join('\t'),
    ref: `${refBase}#${sheetName}!row${row.row}`,
    because: 'spreadsheet row flattened in cell order',
  })

  for (const cell of row.cells) {
    if (cell.value.trim().length === 0) continue
    candidates.push(...classifyLines([cell.value], `${refBase}#${sheetName}!${cell.ref}`))
  }
}

function appendSheetCandidates(candidates: Candidate[], sheet: SpreadsheetSheet, refBase: string): void {
  const header = sheet.rows.find((row) => row.row === sheet.headerRow)
  const headerValues = appendHeaderCandidates(candidates, header, refBase, sheet.name)
  for (const row of sheet.rows) {
    appendRowCandidates(candidates, row, sheet.headerRow, headerValues, refBase, sheet.name)
  }
}

export async function readXlsx(bytes: Uint8Array): Promise<SpreadsheetSheet[]> {
  const entries = await readZipEntries(bytes)
  const decoder = new TextDecoder('utf-8')
  const byName = new Map(entries.map((entry) => [entry.name, decoder.decode(entry.data)]))

  const workbookXml = byName.get('xl/workbook.xml')
  if (!workbookXml) throw new Error('refused: xl/workbook.xml is missing (not a valid .xlsx)')

  const rels = parseWorkbookRels(byName.get('xl/_rels/workbook.xml.rels'))
  const sharedStrings = parseSharedStrings(byName.get('xl/sharedStrings.xml'))
  const sheets = parseWorkbookSheets(workbookXml)

  const parsedSheets = sheets
    .map(({ name, relId }) => {
      const target = rels.get(relId)
      const normalizedTarget = normalizeSheetTarget(target)
      const sheetXml = normalizedTarget ? byName.get(normalizedTarget) : undefined
      return sheetXml ? parseWorksheet(name, sheetXml, sharedStrings) : undefined
    })
    .filter((sheet): sheet is SpreadsheetSheet => sheet !== undefined)

  if (parsedSheets.length === 0) {
    throw new Error('refused: no xl/worksheets/sheetN.xml parts found (not a valid .xlsx)')
  }

  return parsedSheets
}

export async function readXlsxCandidates(bytes: Uint8Array, refBase: string): Promise<Candidate[]> {
  const sheets = await readXlsx(bytes)
  const candidates: Candidate[] = []
  const orderedSheets = [...sheets].sort((a, b) => compareByText(a.name, b.name))

  for (const sheet of orderedSheets) {
    appendSheetCandidates(candidates, sheet, refBase)
  }

  return candidates
}