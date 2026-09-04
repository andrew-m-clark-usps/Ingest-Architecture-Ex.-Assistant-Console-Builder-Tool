// See Spec-Ingest-Tool.md section 4.
//
// Reads ZIP entries from the END OF CENTRAL DIRECTORY + CENTRAL DIRECTORY
// records only -- never by scanning local file headers, whose extra-field
// length can legitimately differ from the central directory's copy and
// would misalign every offset after the first mismatch. The local header
// at each entry's declared offset is read ONLY to compute where its data
// begins (filename/extra length there can differ from the central
// directory's).
//
// Decompression uses Node's built-in `node:zlib` (inflateRawSync) -- a
// runtime built into Node itself, not an npm package in `dependencies` --
// so this still ships with zero third-party runtime dependencies.
import { inflateRawSync } from 'node:zlib'

export interface ZipEntry {
  name: string
  data: Uint8Array
}

const EOCD_SIG = 0x06054b50
const CEN_SIG = 0x02014b50
const LOC_SIG = 0x04034b50

// Decompression-bomb defenses (Spec-Ingest-Tool.md section 2a): caps are
// enforced BEFORE inflating, not after, and are refused rather than
// silently truncated.
const MAX_ENTRIES = 10_000
const MAX_TOTAL_UNCOMPRESSED = 200 * 1024 * 1024 // 200 MiB
const MAX_SINGLE_UNCOMPRESSED = 100 * 1024 * 1024 // 100 MiB
const MAX_COMPRESSION_RATIO = 1_000 // uncompressed / compressed

function findEndOfCentralDirectory(view: DataView): number {
  // The EOCD record is at least 22 bytes and can be followed by a comment
  // of up to 65535 bytes, so scan backward from the end.
  const maxCommentLen = 65535
  const minOffset = Math.max(0, view.byteLength - 22 - maxCommentLen)
  for (let i = view.byteLength - 22; i >= minOffset; i--) {
    if (view.getUint32(i, true) === EOCD_SIG) return i
  }
  throw new Error('refused: not a ZIP (no end-of-central-directory record found)')
}

export async function readZipEntries(bytes: Uint8Array): Promise<ZipEntry[]> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const eocdOffset = findEndOfCentralDirectory(view)

  const totalEntries = view.getUint16(eocdOffset + 10, true)
  const centralDirSize = view.getUint32(eocdOffset + 12, true)
  const centralDirOffset = view.getUint32(eocdOffset + 16, true)

  if (
    totalEntries === 0xffff ||
    centralDirSize === 0xffffffff ||
    centralDirOffset === 0xffffffff
  ) {
    throw new Error('refused: ZIP64 archives are not supported (would require guessing sizes)')
  }
  if (totalEntries > MAX_ENTRIES) {
    throw new Error(`refused: ZIP has ${totalEntries} entries, exceeding the ${MAX_ENTRIES} cap`)
  }

  const entries: ZipEntry[] = []
  let totalUncompressed = 0
  const decoder = new TextDecoder('utf-8')
  let cursor = centralDirOffset

  for (let i = 0; i < totalEntries; i++) {
    if (view.getUint32(cursor, true) !== CEN_SIG) {
      throw new Error(`refused: malformed central directory record at offset ${cursor}`)
    }
    const compressionMethod = view.getUint16(cursor + 10, true)
    const compressedSize = view.getUint32(cursor + 20, true)
    const uncompressedSize = view.getUint32(cursor + 24, true)
    const nameLen = view.getUint16(cursor + 28, true)
    const extraLen = view.getUint16(cursor + 30, true)
    const commentLen = view.getUint16(cursor + 32, true)
    const localHeaderOffset = view.getUint32(cursor + 42, true)

    if (compressedSize === 0xffffffff || uncompressedSize === 0xffffffff) {
      throw new Error('refused: ZIP64 entry sizes are not supported')
    }
    if (uncompressedSize > MAX_SINGLE_UNCOMPRESSED) {
      throw new Error(
        `refused: entry uncompressed size ${uncompressedSize} exceeds the ${MAX_SINGLE_UNCOMPRESSED} byte cap`,
      )
    }
    if (compressedSize > 0 && uncompressedSize / compressedSize > MAX_COMPRESSION_RATIO) {
      throw new Error('refused: entry compression ratio exceeds the decompression-bomb threshold')
    }
    totalUncompressed += uncompressedSize
    if (totalUncompressed > MAX_TOTAL_UNCOMPRESSED) {
      throw new Error(`refused: archive total uncompressed size exceeds the ${MAX_TOTAL_UNCOMPRESSED} byte cap`)
    }

    const nameStart = cursor + 46
    const name = decoder.decode(bytes.subarray(nameStart, nameStart + nameLen))

    if (compressionMethod !== 0 && compressionMethod !== 8) {
      throw new Error(`refused: unsupported ZIP compression method ${compressionMethod} for "${name}"`)
    }

    // Read the local header only to find where the data starts -- its
    // filename/extra lengths are read fresh, never assumed equal to the
    // central directory's.
    if (view.getUint32(localHeaderOffset, true) !== LOC_SIG) {
      throw new Error(`refused: malformed local file header for "${name}"`)
    }
    const localNameLen = view.getUint16(localHeaderOffset + 26, true)
    const localExtraLen = view.getUint16(localHeaderOffset + 28, true)
    const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen
    const compressed = bytes.subarray(dataStart, dataStart + compressedSize)

    let data: Uint8Array
    if (compressionMethod === 0) {
      data = compressed.slice()
    } else {
      data = new Uint8Array(inflateRawSync(compressed))
    }

    entries.push({ name, data })
    cursor = nameStart + nameLen + extraLen + commentLen
  }

  return entries
}
