// DEMO/REFERENCE SCAFFOLD — see Spec-Ingest-Tool.md section 5 (/ToUnicode).

export interface CMap {
  decode(code: number): string | undefined
}

export function parseCMap(_streamText: string): CMap {
  return { decode: () => undefined }
}
