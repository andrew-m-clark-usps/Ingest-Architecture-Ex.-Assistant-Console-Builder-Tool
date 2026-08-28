// See ../Spec-Ingest-Tool.md section 4 ("Reading a .pptx"): a ZIP reader
// with no runtime dependency, built on Node's built-in zlib. Entries are
// read from the END OF CENTRAL DIRECTORY record and the CENTRAL DIRECTORY
// itself — never by scanning local file headers, whose extra-field length
// routinely differs from the central copy and silently lands mid-file.

import { inflateRawSync } from 'node:zlib'

export interface ZipEntry {
  name: string
  data: Uint8Array
}

const EOCD_SIG = 0x06054b50
const CDH_SIG = 0x02014b50
const LFH_SIG = 0x04034b50
const EOCD_MIN_SIZE = 22
const MAX_COMMENT_SIZE = 0xffff

function findEndOfCentralDirectory(buf: Buffer): number {
  // The EOCD record is fixed-size plus an optional trailing comment, so
  // search backward from the end rather than forward from the start.
  const maxScan = Math.min(buf.length, EOCD_MIN_SIZE + MAX_COMMENT_SIZE)
  const start = buf.length - maxScan
  for (let i = buf.length - EOCD_MIN_SIZE; i >= start; i--) {
    if (buf.readUInt32LE(i) === EOCD_SIG) return i
  }
  throw new Error(
    'not a ZIP archive (demo scaffold reader): no End Of Central Directory record found — see Spec-Ingest-Tool.md section 4',
  )
}

export async function readZipEntries(bytes: Uint8Array): Promise<ZipEntry[]> {
  const buf = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const eocdOffset = findEndOfCentralDirectory(buf)

  const totalEntries = buf.readUInt16LE(eocdOffset + 10)
  const cdSize = buf.readUInt32LE(eocdOffset + 12)
  const cdOffset = buf.readUInt32LE(eocdOffset + 16)

  if (totalEntries === 0xffff || cdSize === 0xffffffff || cdOffset === 0xffffffff) {
    throw new Error(
      'ZIP64 archive not supported by this demo scaffold reader — refusing rather than silently truncating (see Spec-Ingest-Tool.md section 4)',
    )
  }

  const entries: ZipEntry[] = []
  let pos = cdOffset

  for (let i = 0; i < totalEntries; i++) {
    if (buf.readUInt32LE(pos) !== CDH_SIG) {
      throw new Error(
        `corrupt ZIP central directory at entry ${i}: expected central file header signature`,
      )
    }
    const compressionMethod = buf.readUInt16LE(pos + 10)
    const compressedSize = buf.readUInt32LE(pos + 20)
    const uncompressedSize = buf.readUInt32LE(pos + 24)
    const nameLen = buf.readUInt16LE(pos + 28)
    const extraLen = buf.readUInt16LE(pos + 30)
    const commentLen = buf.readUInt16LE(pos + 32)
    const localHeaderOffset = buf.readUInt32LE(pos + 42)

    if (compressedSize === 0xffffffff || uncompressedSize === 0xffffffff) {
      throw new Error(
        `entry at index ${i} uses a ZIP64 size field, not supported by this demo scaffold reader`,
      )
    }

    const name = buf.toString('utf8', pos + 46, pos + 46 + nameLen)
    pos += 46 + nameLen + extraLen + commentLen

    // Only the compressed-size/method from the CENTRAL directory are
    // trusted; the local header is used only to locate where data starts.
    if (buf.readUInt32LE(localHeaderOffset) !== LFH_SIG) {
      throw new Error(`corrupt ZIP local header for entry "${name}"`)
    }
    const localNameLen = buf.readUInt16LE(localHeaderOffset + 26)
    const localExtraLen = buf.readUInt16LE(localHeaderOffset + 28)
    const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen
    const compressed = buf.subarray(dataStart, dataStart + compressedSize)

    let data: Uint8Array
    if (compressionMethod === 0) {
      data = new Uint8Array(compressed)
    } else if (compressionMethod === 8) {
      data = new Uint8Array(inflateRawSync(compressed))
    } else {
      throw new Error(
        `entry "${name}" uses unsupported compression method ${compressionMethod} (only stored=0 and deflate=8 are handled)`,
      )
    }

    // A directory entry (trailing slash, zero bytes) carries no content.
    if (!name.endsWith('/')) {
      entries.push({ name, data })
    }
  }

  return entries
}
