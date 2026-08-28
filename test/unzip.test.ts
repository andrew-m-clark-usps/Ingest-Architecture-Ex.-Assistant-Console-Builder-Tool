import { test } from 'vitest'
import assert from 'node:assert/strict'
import { deflateRawSync } from 'node:zlib'
import { readZipEntries } from '../src/unzip.js'

function crc32(buf: Buffer): number {
  let crc = ~0
  for (const byte of buf) {
    crc ^= byte
    for (let i = 0; i < 8; i++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1
    }
  }
  return ~crc >>> 0
}

/** Build a minimal, valid ZIP file (one stored entry, one deflated entry). */
function buildZip(files: { name: string; data: Buffer; store?: boolean }[]): Buffer {
  const localParts: Buffer[] = []
  const centralParts: Buffer[] = []
  let offset = 0

  for (const file of files) {
    const nameBuf = Buffer.from(file.name, 'utf-8')
    const stored = !!file.store
    const compressed = stored ? file.data : deflateRawSync(file.data)
    const method = stored ? 0 : 8
    const crc = crc32(file.data)

    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4) // version needed
    local.writeUInt16LE(0, 6) // flags
    local.writeUInt16LE(method, 8)
    local.writeUInt16LE(0, 10) // mod time
    local.writeUInt16LE(0, 12) // mod date
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(compressed.length, 18)
    local.writeUInt32LE(file.data.length, 22)
    local.writeUInt16LE(nameBuf.length, 26)
    local.writeUInt16LE(0, 28)
    localParts.push(local, nameBuf, compressed)

    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE(20, 4) // version made by
    central.writeUInt16LE(20, 6) // version needed
    central.writeUInt16LE(0, 8) // flags
    central.writeUInt16LE(method, 10)
    central.writeUInt16LE(0, 12)
    central.writeUInt16LE(0, 14)
    central.writeUInt32LE(crc, 16)
    central.writeUInt32LE(compressed.length, 20)
    central.writeUInt32LE(file.data.length, 24)
    central.writeUInt16LE(nameBuf.length, 28)
    central.writeUInt16LE(0, 30) // extra len
    central.writeUInt16LE(0, 32) // comment len
    central.writeUInt16LE(0, 34) // disk number
    central.writeUInt16LE(0, 36) // internal attrs
    central.writeUInt32LE(0, 38) // external attrs
    central.writeUInt32LE(offset, 42)
    centralParts.push(central, nameBuf)

    offset += local.length + nameBuf.length + compressed.length
  }

  const centralDir = Buffer.concat(centralParts)
  const localDir = Buffer.concat(localParts)

  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0)
  eocd.writeUInt16LE(0, 4)
  eocd.writeUInt16LE(0, 6)
  eocd.writeUInt16LE(files.length, 8)
  eocd.writeUInt16LE(files.length, 10)
  eocd.writeUInt32LE(centralDir.length, 12)
  eocd.writeUInt32LE(localDir.length, 16)
  eocd.writeUInt16LE(0, 20)

  return Buffer.concat([localDir, centralDir, eocd])
}

test('reads a stored entry', async () => {
  const zip = buildZip([{ name: 'hello.txt', data: Buffer.from('hello world'), store: true }])
  const entries = await readZipEntries(new Uint8Array(zip))
  assert.equal(entries.length, 1)
  assert.equal(entries[0].name, 'hello.txt')
  assert.equal(Buffer.from(entries[0].data).toString('utf-8'), 'hello world')
})

test('reads a deflated entry', async () => {
  const text = 'a'.repeat(500) + 'b'.repeat(500)
  const zip = buildZip([{ name: 'big.txt', data: Buffer.from(text) }])
  const entries = await readZipEntries(new Uint8Array(zip))
  assert.equal(Buffer.from(entries[0].data).toString('utf-8'), text)
})

test('reads multiple entries in order', async () => {
  const zip = buildZip([
    { name: 'a.txt', data: Buffer.from('A'), store: true },
    { name: 'b.txt', data: Buffer.from('B'), store: true },
  ])
  const entries = await readZipEntries(new Uint8Array(zip))
  assert.deepEqual(entries.map((e) => e.name), ['a.txt', 'b.txt'])
})

test('throws on a non-ZIP buffer instead of silently returning nothing', async () => {
  await assert.rejects(() => readZipEntries(new Uint8Array(Buffer.from('not a zip'))))
})
