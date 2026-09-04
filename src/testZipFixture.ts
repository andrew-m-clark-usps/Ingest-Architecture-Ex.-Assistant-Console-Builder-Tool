// Test-only helper: builds a minimal, valid, STORED (uncompressed) ZIP
// archive in memory so unzip/pptx tests don't need a binary fixture file
// checked into the repo. Not exported from index.ts -- this is scaffolding
// for tests, not part of the shipped reader.

export interface FixtureEntry {
  name: string
  data: Uint8Array
}

function crc32(data: Uint8Array): number {
  let crc = ~0
  for (const byte of data) {
    crc ^= byte
    for (let i = 0; i < 8; i++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1
    }
  }
  return ~crc >>> 0
}

export function buildStoredZip(entries: FixtureEntry[]): Uint8Array {
  const localChunks: Uint8Array[] = []
  const centralChunks: Uint8Array[] = []
  let offset = 0

  for (const entry of entries) {
    const nameBytes = new TextEncoder().encode(entry.name)
    const crc = crc32(entry.data)
    const size = entry.data.length

    const local = new DataView(new ArrayBuffer(30))
    local.setUint32(0, 0x04034b50, true)
    local.setUint16(4, 20, true) // version needed
    local.setUint16(6, 0, true) // flags
    local.setUint16(8, 0, true) // compression: stored
    local.setUint16(10, 0, true) // mod time
    local.setUint16(12, 0, true) // mod date
    local.setUint32(14, crc, true)
    local.setUint32(18, size, true) // compressed size
    local.setUint32(22, size, true) // uncompressed size
    local.setUint16(26, nameBytes.length, true)
    local.setUint16(28, 0, true) // extra length
    const localHeader = new Uint8Array(local.buffer)
    localChunks.push(localHeader, nameBytes, entry.data)

    const central = new DataView(new ArrayBuffer(46))
    central.setUint32(0, 0x02014b50, true)
    central.setUint16(4, 20, true) // version made by
    central.setUint16(6, 20, true) // version needed
    central.setUint16(8, 0, true) // flags
    central.setUint16(10, 0, true) // compression
    central.setUint16(12, 0, true)
    central.setUint16(14, 0, true)
    central.setUint32(16, crc, true)
    central.setUint32(20, size, true)
    central.setUint32(24, size, true)
    central.setUint16(28, nameBytes.length, true)
    central.setUint16(30, 0, true) // extra length
    central.setUint16(32, 0, true) // comment length
    central.setUint16(34, 0, true) // disk number
    central.setUint16(36, 0, true) // internal attrs
    central.setUint32(38, 0, true) // external attrs
    central.setUint32(42, offset, true) // local header offset
    centralChunks.push(new Uint8Array(central.buffer), nameBytes)

    offset += localHeader.length + nameBytes.length + entry.data.length
  }

  const centralDirOffset = offset
  let centralSize = 0
  for (const chunk of centralChunks) centralSize += chunk.length

  const eocd = new DataView(new ArrayBuffer(22))
  eocd.setUint32(0, 0x06054b50, true)
  eocd.setUint16(4, 0, true)
  eocd.setUint16(6, 0, true)
  eocd.setUint16(8, entries.length, true)
  eocd.setUint16(10, entries.length, true)
  eocd.setUint32(12, centralSize, true)
  eocd.setUint32(16, centralDirOffset, true)
  eocd.setUint16(20, 0, true)

  const all = [...localChunks, ...centralChunks, new Uint8Array(eocd.buffer)]
  const total = all.reduce((sum, c) => sum + c.length, 0)
  const out = new Uint8Array(total)
  let cursor = 0
  for (const chunk of all) {
    out.set(chunk, cursor)
    cursor += chunk.length
  }
  return out
}
