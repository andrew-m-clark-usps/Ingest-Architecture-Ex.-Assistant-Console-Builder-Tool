// DEMO/REFERENCE SCAFFOLD — see Spec-Ingest-Tool.md section 4.
// The real implementation reads ZIP entries from the central directory
// (never by scanning local headers) via DecompressionStream, with no
// runtime library. This stub only defines the shape.

export interface ZipEntry {
  name: string
  data: Uint8Array
}

export async function readZipEntries(_bytes: Uint8Array): Promise<ZipEntry[]> {
  throw new Error(
    'not implemented (demo scaffold): see Spec-Ingest-Tool.md section 4 for the required central-directory ZIP reader',
  )
}
