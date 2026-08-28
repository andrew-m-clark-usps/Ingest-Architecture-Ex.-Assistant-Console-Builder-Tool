import { test } from 'vitest'
import assert from 'node:assert/strict'
import { deflateRawSync } from 'node:zlib'
import { readXlsx, classifySpreadsheet } from '../src/xlsx.js'

function crc32(buf: Buffer): number {
  let crc = ~0
  for (const byte of buf) {
    crc ^= byte
    for (let i = 0; i < 8; i++) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1
  }
  return ~crc >>> 0
}

function buildZip(files: { name: string; data: Buffer }[]): Buffer {
  const localParts: Buffer[] = []
  const centralParts: Buffer[] = []
  let offset = 0
  for (const file of files) {
    const nameBuf = Buffer.from(file.name, 'utf-8')
    const compressed = deflateRawSync(file.data)
    const crc = crc32(file.data)
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(0, 6)
    local.writeUInt16LE(8, 8)
    local.writeUInt16LE(0, 10)
    local.writeUInt16LE(0, 12)
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(compressed.length, 18)
    local.writeUInt32LE(file.data.length, 22)
    local.writeUInt16LE(nameBuf.length, 26)
    local.writeUInt16LE(0, 28)
    localParts.push(local, nameBuf, compressed)

    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE(20, 4)
    central.writeUInt16LE(20, 6)
    central.writeUInt16LE(0, 8)
    central.writeUInt16LE(8, 10)
    central.writeUInt16LE(0, 12)
    central.writeUInt16LE(0, 14)
    central.writeUInt32LE(crc, 16)
    central.writeUInt32LE(compressed.length, 20)
    central.writeUInt32LE(file.data.length, 24)
    central.writeUInt16LE(nameBuf.length, 28)
    central.writeUInt16LE(0, 30)
    central.writeUInt16LE(0, 32)
    central.writeUInt16LE(0, 34)
    central.writeUInt16LE(0, 36)
    central.writeUInt32LE(0, 38)
    central.writeUInt32LE(offset, 42)
    centralParts.push(central, nameBuf)
    offset += local.length + nameBuf.length + compressed.length
  }
  const centralDir = Buffer.concat(centralParts)
  const localDir = Buffer.concat(localParts)
  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0)
  eocd.writeUInt16LE(files.length, 8)
  eocd.writeUInt16LE(files.length, 10)
  eocd.writeUInt32LE(centralDir.length, 12)
  eocd.writeUInt32LE(localDir.length, 16)
  return Buffer.concat([localDir, centralDir, eocd])
}

function buildMinimalXlsx(): Buffer {
  const workbookXml = `<workbook><sheets><sheet name="Field Map" sheetId="1" r:id="rId1"/></sheets></workbook>`
  const sharedStrings = `<sst count="4" uniqueCount="4">
    <si><t>Old Name</t></si>
    <si><t>New Name</t></si>
    <si><t>Biz Name</t></si>
    <si><t>Business Name</t></si>
  </sst>`
  const sheet1 = `<worksheet><sheetData>
    <row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row>
    <row r="2"><c r="A2" t="s"><v>2</v></c><c r="B2" t="s"><v>3</v></c></row>
  </sheetData></worksheet>`

  return buildZip([
    { name: 'xl/workbook.xml', data: Buffer.from(workbookXml) },
    { name: 'xl/sharedStrings.xml', data: Buffer.from(sharedStrings) },
    { name: 'xl/worksheets/sheet1.xml', data: Buffer.from(sheet1) },
  ])
}

test('reads shared strings and reconstructs cell position from the r attribute', async () => {
  const sheets = await readXlsx(new Uint8Array(buildMinimalXlsx()))
  assert.equal(sheets.length, 1)
  assert.equal(sheets[0].name, 'Field Map')
  assert.equal(sheets[0].rows[0].cells['A'], 'Old Name')
  assert.equal(sheets[0].rows[1].cells['B'], 'Business Name')
})

test('classifies a two-column old-name/new-name sheet as a mapping', async () => {
  const sheets = await readXlsx(new Uint8Array(buildMinimalXlsx()))
  const candidates = classifySpreadsheet(sheets[0], 'fields.xlsx')
  assert.equal(candidates.length, 1)
  assert.equal(candidates[0].text, 'Biz Name -> Business Name')
  assert.match(candidates[0].because, /mapping/)
})

test('throws a clear error for a non-.xlsx ZIP', async () => {
  const zip = buildZip([{ name: 'ppt/slides/slide1.xml', data: Buffer.from('<p/>') }])
  await assert.rejects(() => readXlsx(new Uint8Array(zip)), /worksheets/)
})
