// DEMO/REFERENCE SCAFFOLD — see Spec-Ingest-Tool.md section 4.

export interface SlideLines {
  slide: number
  lines: string[]
}

export async function readPptx(_bytes: Uint8Array): Promise<SlideLines[]> {
  throw new Error('not implemented (demo scaffold): see Spec-Ingest-Tool.md section 4')
}
