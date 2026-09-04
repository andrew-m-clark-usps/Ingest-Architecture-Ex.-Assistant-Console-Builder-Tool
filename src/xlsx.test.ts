import { describe, expect, it } from 'vitest'
import { buildStoredZip } from './testZipFixture.js'
import { readXlsx, readXlsxCandidates } from './xlsx.js'

function x(text: string): Uint8Array {
  return new TextEncoder().encode(text)
}

function workbookXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
  <workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
    <sheets>
      <sheet name="Mappings" sheetId="1" r:id="rId1" />
    </sheets>
  </workbook>`
}

function workbookRelsXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
  <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
    <Relationship Id="rId1" Type="worksheet" Target="worksheets/sheet1.xml" />
  </Relationships>`
}

function sharedStringsXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
  <sst>
    <si><t>Old Name</t></si>
    <si><t>New Name</t></si>
    <si><t>Legacy CRID</t></si>
    <si><t>Customer Record</t></si>
    <si><t>Category</t></si>
    <si><t>Validation Rule</t></si>
    <si><t>Retention</t></si>
    <si><t>The vendor must retain records for five years.</t></si>
  </sst>`
}

function sheetXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
  <worksheet>
    <sheetData>
      <row r="1">
        <c r="A1" t="s"><v>0</v></c>
        <c r="B1" t="s"><v>1</v></c>
        <c r="D1" t="s"><v>4</v></c>
      </row>
      <row r="2">
        <c r="A2" t="s"><v>2</v></c>
        <c r="B2" t="s"><v>3</v></c>
      </row>
      <row r="3">
        <c r="A3" t="s"><v>0</v></c>
        <c r="B3" t="s"><v>1</v></c>
        <c r="D3" t="s"><v>4</v></c>
      </row>
      <row r="4">
        <c r="A4" t="inlineStr"><is><t>Validation Rule</t></is></c>
        <c r="B4" t="s"><v>7</v></c>
        <c r="C4"><f>SUM(1,1)</f><v>2</v></c>
      </row>
      <row r="5">
        <c r="A5" t="s"><v>6</v></c>
      </row>
    </sheetData>
    <mergeCells count="1">
      <mergeCell ref="A5:B5" />
    </mergeCells>
  </worksheet>`
}

function xlsxFixture(): Uint8Array {
  return buildStoredZip([
    { name: '[Content_Types].xml', data: x('<Types/>') },
    { name: 'xl/workbook.xml', data: x(workbookXml()) },
    { name: 'xl/_rels/workbook.xml.rels', data: x(workbookRelsXml()) },
    { name: 'xl/sharedStrings.xml', data: x(sharedStringsXml()) },
    { name: 'xl/worksheets/sheet1.xml', data: x(sheetXml()) },
  ])
}

describe('readXlsx', () => {
  it('reads shared strings, reconstructs sparse cells, and carries merged-cell values', async () => {
    const sheets = await readXlsx(xlsxFixture())

    expect(sheets).toHaveLength(1)
    expect(sheets[0].name).toBe('Mappings')
    expect(sheets[0].headerRow).toBe(1)
    expect(sheets[0].rows[0].cells.map((cell) => cell.value)).toEqual(['Old Name', 'New Name', '', 'Category'])
    expect(sheets[0].rows[4].cells.map((cell) => cell.value)).toEqual(['Retention', 'Retention'])
    expect(sheets[0].rows[3].cells[2].computed).toBe(true)
  })

  it('refuses a workbook with no worksheet parts', async () => {
    const bytes = buildStoredZip([{ name: 'xl/workbook.xml', data: x(workbookXml()) }])
    await expect(readXlsx(bytes)).rejects.toThrow(/no xl\/worksheets\/sheetN\.xml/i)
  })
})

describe('readXlsxCandidates', () => {
  it('emits header fields, skips repeated headers, flattens rows, and classifies rule cells', async () => {
    const candidates = await readXlsxCandidates(xlsxFixture(), 'mapping.xlsx')

    expect(candidates.some((candidate) => candidate.kind === 'field' && candidate.text === 'Old Name')).toBe(true)
    expect(candidates.some((candidate) => candidate.kind === 'field' && candidate.text === 'Category')).toBe(true)
    expect(candidates.filter((candidate) => candidate.kind === 'record' && candidate.text === 'Old Name\tNew Name\t\tCategory')).toHaveLength(0)
    expect(candidates.some((candidate) => candidate.kind === 'record' && candidate.text === 'Legacy CRID\tCustomer Record')).toBe(true)
    expect(candidates.some((candidate) => candidate.kind === 'rule' && candidate.text === 'The vendor must retain records for five years.')).toBe(true)
  })
})