// DEMO/REFERENCE SCAFFOLD — see Spec-Ingest-Tool.md section 5.
// The real implementation handles object streams, /ToUnicode CMaps, and
// line reconstruction from glyph coordinates. Not implemented here.

export interface PageLines {
  page: number
  lines: string[]
}

export async function readPdf(_bytes: Uint8Array): Promise<PageLines[]> {
  throw new Error('not implemented (demo scaffold): see Spec-Ingest-Tool.md section 5')
}
