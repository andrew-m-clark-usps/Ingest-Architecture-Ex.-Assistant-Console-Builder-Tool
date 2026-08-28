// See ../Spec-Ingest-Tool.md section 5 ("/ToUnicode is not optional"). A
// subsetted font encodes text in its own byte codes, so a PDF text run must
// be decoded through this map or "Marketing" reads as garbage glyphs.
// Parses both beginbfchar (single code -> string) and beginbfrange, in
// both its forms: a contiguous destination (only the destination's low
// unit increments) and an explicit destination array.

export interface CMap {
  decode(code: number): string | undefined
}

/** One or more <hex> groups, e.g. <004D> or <0041 0042>. */
function hexGroupsToString(hex: string): string {
  const units: number[] = []
  for (let i = 0; i + 4 <= hex.length; i += 4) {
    units.push(parseInt(hex.slice(i, i + 4), 16))
  }
  return String.fromCharCode(...units)
}

function parseHexToken(token: string): string {
  // Accept both 2-hex-digit (single byte code) and 4-hex-digit inputs by
  // normalising to whole UTF-16 code units (pad odd-length hex strings).
  const clean = token.length % 4 === 0 ? token : token.padStart(Math.ceil(token.length / 4) * 4, '0')
  return hexGroupsToString(clean)
}

function hexTokenToCode(token: string): number {
  return parseInt(token, 16)
}

export function parseCMap(streamText: string): CMap {
  const map = new Map<number, string>()

  // beginbfchar ... endbfchar: pairs of <srcCode> <dstString>
  const bfcharBlockRe = /beginbfchar([\s\S]*?)endbfchar/g
  const bfcharPairRe = /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g
  let blockMatch: RegExpExecArray | null
  while ((blockMatch = bfcharBlockRe.exec(streamText)) !== null) {
    bfcharPairRe.lastIndex = 0
    let pairMatch: RegExpExecArray | null
    while ((pairMatch = bfcharPairRe.exec(blockMatch[1])) !== null) {
      const code = hexTokenToCode(pairMatch[1])
      map.set(code, parseHexToken(pairMatch[2]))
    }
  }

  // beginbfrange ... endbfrange: <start> <end> <dst> | <start> <end> [<d1> <d2> ...]
  const bfrangeBlockRe = /beginbfrange([\s\S]*?)endbfrange/g
  const rangeEntryRe =
    /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*(?:<([0-9A-Fa-f]+)>|\[([\s\S]*?)\])/g
  let rangeBlock: RegExpExecArray | null
  while ((rangeBlock = bfrangeBlockRe.exec(streamText)) !== null) {
    rangeEntryRe.lastIndex = 0
    let entry: RegExpExecArray | null
    while ((entry = rangeEntryRe.exec(rangeBlock[1])) !== null) {
      const start = hexTokenToCode(entry[1])
      const end = hexTokenToCode(entry[2])
      if (entry[4] !== undefined) {
        // Explicit array form: each code maps to the corresponding array entry.
        const items = [...entry[4].matchAll(/<([0-9A-Fa-f]+)>/g)].map((m) => parseHexToken(m[1]))
        for (let code = start, i = 0; code <= end && i < items.length; code++, i++) {
          map.set(code, items[i])
        }
      } else if (entry[3] !== undefined) {
        // Contiguous destination form: only the low unit of the destination
        // increments as the source code increments across the range.
        const dstUnits = [...entry[3]].length > 0 ? entry[3].match(/.{1,4}/g) ?? [] : []
        const dstCodePoints = dstUnits.map((h) => parseInt(h, 16))
        const lastIdx = dstCodePoints.length - 1
        for (let code = start, offset = 0; code <= end; code++, offset++) {
          const units = dstCodePoints.slice()
          units[lastIdx] = dstCodePoints[lastIdx] + offset
          map.set(code, String.fromCharCode(...units))
        }
      }
    }
  }

  return {
    decode(code: number) {
      return map.get(code)
    },
  }
}
