// See Spec-Ingest-Tool.md section 5 (/ToUnicode).
//
// Parses the subset of the PostScript CMap language that /ToUnicode
// streams actually use: beginbfchar/endbfchar pairs, and both forms of
// beginbfrange/endbfrange (a contiguous range where only the last hex
// unit increments, and an explicit per-code array). Unmapped codes are
// dropped rather than guessed.

export interface CMap {
  decode(code: number): string | undefined
}

function hexToString(hex: string): string {
  // A /ToUnicode destination is UTF-16BE, expressed as hex digits in
  // groups of 4 (one UTF-16 code unit each).
  let out = ''
  for (let i = 0; i + 4 <= hex.length; i += 4) {
    out += String.fromCharCode(parseInt(hex.slice(i, i + 4), 16))
  }
  return out
}

function incrementHex(hex: string): string {
  const value = BigInt('0x' + hex) + 1n
  return value.toString(16).padStart(hex.length, '0')
}

export function parseCMap(streamText: string): CMap {
  const map = new Map<number, string>()

  const bfcharBlocks = streamText.match(/beginbfchar([\s\S]*?)endbfchar/g) ?? []
  for (const block of bfcharBlocks) {
    const pairs = block.matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g)
    for (const [, src, dst] of pairs) {
      map.set(parseInt(src, 16), hexToString(dst))
    }
  }

  const bfrangeBlocks = streamText.match(/beginbfrange([\s\S]*?)endbfrange/g) ?? []
  for (const block of bfrangeBlocks) {
    // Explicit array form: <lo> <hi> [ <dst1> <dst2> ... ]
    const arrayForm = block.matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*\[([^\]]*)\]/g)
    const arrayRanges = new Set<string>()
    for (const [full, lo, , list] of arrayForm) {
      arrayRanges.add(full)
      const dsts = [...list.matchAll(/<([0-9a-fA-F]+)>/g)].map((m) => m[1])
      const loCode = parseInt(lo, 16)
      dsts.forEach((dst, i) => map.set(loCode + i, hexToString(dst)))
    }
    // Contiguous form: <lo> <hi> <dstStart> -- only the last hex unit of
    // the destination increments per code, never carried into earlier
    // units.
    const contiguousForm = block.matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g)
    for (const [full, lo, hi, dstStart] of contiguousForm) {
      if (arrayRanges.has(full)) continue
      const loCode = parseInt(lo, 16)
      const hiCode = parseInt(hi, 16)
      let dst = dstStart
      for (let code = loCode; code <= hiCode; code++) {
        map.set(code, hexToString(dst))
        dst = incrementHex(dst)
      }
    }
  }

  return {
    decode(code: number) {
      return map.get(code)
    },
  }
}
