// See ../Spec-Ingest-Tool.md section 5 ("Reading a PDF"). Scope is narrow
// on purpose: read what office software emits, refuse the rest. No render,
// no layout, no OCR. Objects are indexed by SCANNING the file, never from
// the xref table (a linearized/incrementally-updated file has several
// xrefs and picking the wrong one silently loses pages). Object streams
// (PDF 1.5 /ObjStm) are mandatory to support or a modern PDF reads as zero
// pages. Structure bytes are parsed as Latin-1 (1 byte : 1 char, lossless
// for binary payloads) since PDF's own syntax is ASCII regardless of the
// bytes a stream carries.

import { inflateSync, inflateRawSync } from 'node:zlib'
import { parseCMap, type CMap } from './cmap.js'

export interface PageLines {
  page: number
  lines: string[]
}

interface RawObject {
  dict: string
  streamStart: number
  streamEnd: number
}

interface TextRun {
  x: number
  y: number
  size: number
  text: string
}

const STOPWORDS = new Set(['to', 'a', 'an', 'in', 'on', 'of', 'is', 'at', 'or', 'no', 'so'])

function inflateEither(bytes: Buffer): Buffer {
  try {
    return inflateSync(bytes)
  } catch {
    return inflateRawSync(bytes)
  }
}

/** Index every "N G obj ... endobj" (or "... stream ... endstream") in the file by scanning. */
function scanObjects(latin1: string): Map<number, RawObject> {
  const objects = new Map<number, RawObject>()
  const headerRe = /(\d+)\s+(\d+)\s+obj\b/g
  let m: RegExpExecArray | null
  while ((m = headerRe.exec(latin1)) !== null) {
    const objNum = Number(m[1])
    const bodyStart = headerRe.lastIndex
    const streamKwIdx = latin1.indexOf('stream', bodyStart)
    const endobjIdx = latin1.indexOf('endobj', bodyStart)
    if (endobjIdx === -1) continue
    if (streamKwIdx !== -1 && streamKwIdx < endobjIdx) {
      // Data begins right after "stream" and the single EOL the spec
      // requires there (CRLF or LF) — trim it or a valid deflate stream
      // fails to decompress.
      let dataStart = streamKwIdx + 'stream'.length
      if (latin1[dataStart] === '\r') dataStart++
      if (latin1[dataStart] === '\n') dataStart++
      const endstreamIdx = latin1.indexOf('endstream', dataStart)
      if (endstreamIdx === -1) continue
      let dataEnd = endstreamIdx
      if (latin1[dataEnd - 1] === '\n') dataEnd--
      if (latin1[dataEnd - 1] === '\r') dataEnd--
      objects.set(objNum, {
        dict: latin1.slice(bodyStart, streamKwIdx),
        streamStart: dataStart,
        streamEnd: dataEnd,
      })
    } else {
      objects.set(objNum, { dict: latin1.slice(bodyStart, endobjIdx), streamStart: -1, streamEnd: -1 })
    }
  }
  return objects
}

function getStreamBytes(latin1: string, obj: RawObject): Buffer {
  const raw = Buffer.from(latin1.slice(obj.streamStart, obj.streamEnd), 'latin1')
  if (/\/FlateDecode\b/.test(obj.dict)) return inflateEither(raw)
  return raw
}

/** Expand every /Type /ObjStm object into its member objects (dict-only; ObjStm never holds streams). */
function expandObjectStreams(latin1: string, objects: Map<number, RawObject>): void {
  for (const [, obj] of [...objects]) {
    if (obj.streamStart === -1 || !/\/Type\s*\/ObjStm\b/.test(obj.dict)) continue
    const nMatch = /\/N\s+(\d+)/.exec(obj.dict)
    const firstMatch = /\/First\s+(\d+)/.exec(obj.dict)
    if (!nMatch || !firstMatch) continue
    const count = Number(nMatch[1])
    const first = Number(firstMatch[1])
    const decompressed = getStreamBytes(latin1, obj).toString('latin1')

    const header = decompressed.slice(0, first)
    const pairs = [...header.matchAll(/(\d+)\s+(\d+)/g)].map((p) => [Number(p[1]), Number(p[2])] as const)
    for (let i = 0; i < Math.min(count, pairs.length); i++) {
      const [objNum, relOffset] = pairs[i]
      const bodyStart = first + relOffset
      const bodyEnd = i + 1 < pairs.length ? first + pairs[i + 1][1] : decompressed.length
      if (!objects.has(objNum)) {
        objects.set(objNum, { dict: decompressed.slice(bodyStart, bodyEnd), streamStart: -1, streamEnd: -1 })
      }
    }
  }
}

function resolveRef(objects: Map<number, RawObject>, ref: string): RawObject | undefined {
  const m = /^\s*(\d+)\s+\d+\s+R\s*$/.exec(ref)
  return m ? objects.get(Number(m[1])) : undefined
}

function findFontToUnicodeMaps(latin1: string, objects: Map<number, RawObject>, pageDict: string): Map<string, CMap> {
  const fonts = new Map<string, CMap>()

  let resourcesText = pageDict
  const resourcesRefMatch = /\/Resources\s+(\d+\s+0\s+R)/.exec(pageDict)
  if (resourcesRefMatch) {
    const resolved = resolveRef(objects, resourcesRefMatch[1])
    if (resolved) resourcesText = resolved.dict
  }

  const fontDictMatch = /\/Font\s*<<([\s\S]*?)>>/.exec(resourcesText)
  const fontDictInline = fontDictMatch?.[1]
  let fontEntries = fontDictInline
  if (!fontEntries) {
    const fontRefMatch = /\/Font\s+(\d+\s+0\s+R)/.exec(resourcesText)
    if (fontRefMatch) {
      const resolved = resolveRef(objects, fontRefMatch[1])
      const inline = resolved ? /<<([\s\S]*?)>>/.exec(resolved.dict) : null
      fontEntries = inline?.[1]
    }
  }
  if (!fontEntries) return fonts

  const entryRe = /\/([A-Za-z0-9+.\-]+)\s+(\d+)\s+0\s+R/g
  let entry: RegExpExecArray | null
  while ((entry = entryRe.exec(fontEntries)) !== null) {
    const fontName = entry[1]
    const fontObj = objects.get(Number(entry[2]))
    if (!fontObj) continue
    const toUnicodeMatch = /\/ToUnicode\s+(\d+)\s+0\s+R/.exec(fontObj.dict)
    if (!toUnicodeMatch) continue
    const cmapObj = objects.get(Number(toUnicodeMatch[1]))
    if (!cmapObj || cmapObj.streamStart === -1) continue
    const cmapText = getStreamBytes(latin1, cmapObj).toString('latin1')
    fonts.set(fontName, parseCMap(cmapText))
  }
  return fonts
}

function decodeShowString(raw: string, font: CMap | undefined): string {
  // Unescape PDF string literal syntax first: \(, \), \\, and octal \ddd.
  let unescaped = ''
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] === '\\' && i + 1 < raw.length) {
      const next = raw[i + 1]
      if (next === 'n') { unescaped += '\n'; i++ }
      else if (next === 'r') { unescaped += '\r'; i++ }
      else if (next === 't') { unescaped += '\t'; i++ }
      else if (/[0-7]/.test(next)) {
        const octal = raw.slice(i + 1, i + 4).match(/^[0-7]{1,3}/)?.[0] ?? next
        unescaped += String.fromCharCode(parseInt(octal, 8) & 0xff)
        i += octal.length
      } else { unescaped += next; i++ }
    } else {
      unescaped += raw[i]
    }
  }
  if (!font) return unescaped
  let out = ''
  for (let i = 0; i < unescaped.length; i++) {
    const decoded = font.decode(unescaped.charCodeAt(i))
    if (decoded !== undefined) out += decoded
    // Unmapped codes are dropped rather than guessed, per section 5.
  }
  return out
}

function extractRunsFromContentStream(content: string, fonts: Map<string, CMap>): TextRun[] {
  const runs: TextRun[] = []
  let inText = false
  let currentFont: CMap | undefined
  let fontSize = 12
  let originX = 0
  let originY = 0
  let tx = 0
  let ty = 0

  // One pass tokenizing operators in document order.
  const tokenRe =
    /BT|ET|\/([A-Za-z0-9+.\-]+)\s+([\d.\-]+)\s+Tf|([\d.\-]+)\s+([\d.\-]+)\s+Td|([\d.\-]+)\s+([\d.\-]+)\s+TD|([\d.\-]+)\s+[\d.\-]+\s+[\d.\-]+\s+[\d.\-]+\s+([\d.\-]+)\s+([\d.\-]+)\s+Tm|\(((?:[^()\\]|\\.)*)\)\s*Tj|\[((?:[^\]])*)\]\s*TJ/g

  let m: RegExpExecArray | null
  while ((m = tokenRe.exec(content)) !== null) {
    const [whole, tfFont, tfSize, tdX, tdY, tDX, tDY, tmA, tmE, tmF, tjStr, tjArr] = m
    if (whole === 'BT') {
      inText = true
      tx = originX = 0
      ty = originY = 0
    } else if (whole === 'ET') {
      inText = false
    } else if (tfFont !== undefined) {
      currentFont = fonts.get(tfFont)
      fontSize = Number(tfSize)
    } else if (tdX !== undefined) {
      originX += Number(tdX)
      originY += Number(tdY)
      tx = originX
      ty = originY
    } else if (tDX !== undefined) {
      originX += Number(tDX)
      originY += Number(tDY)
      tx = originX
      ty = originY
    } else if (tmE !== undefined) {
      // Tm sets an absolute text-space origin (e, f are the translation terms).
      originX = Number(tmE)
      originY = Number(tmF)
      tx = originX
      ty = originY
      void tmA
    } else if (inText && tjStr !== undefined) {
      const text = decodeShowString(tjStr, currentFont)
      if (text.length > 0) runs.push({ x: tx, y: ty, size: fontSize, text })
      tx += text.length * fontSize * 0.5
    } else if (inText && tjArr !== undefined) {
      let text = ''
      const partRe = /\(((?:[^()\\]|\\.)*)\)|(-?\d+(?:\.\d+)?)/g
      let part: RegExpExecArray | null
      while ((part = partRe.exec(tjArr)) !== null) {
        if (part[1] !== undefined) {
          text += decodeShowString(part[1], currentFont)
        } else if (part[2] !== undefined && Number(part[2]) < -100) {
          // A large negative adjustment between runs in a TJ array is how
          // many producers express a word space rather than a real Tj/Td.
          text += ' '
        }
      }
      if (text.trim().length > 0) runs.push({ x: tx, y: ty, size: fontSize, text })
      tx += text.length * fontSize * 0.5
    }
  }
  return runs
}

/** Reconstruct lines from positioned runs: group by rounded y, sort by x, order groups top-down. */
function runsToLines(runs: TextRun[]): string[] {
  const groups = new Map<number, TextRun[]>()
  for (const run of runs) {
    const key = Math.round(run.y / 2) * 2
    const list = groups.get(key) ?? []
    list.push(run)
    groups.set(key, list)
  }
  const orderedYs = [...groups.keys()].sort((a, b) => b - a) // PDF y grows upward
  const lines: string[] = []
  for (const y of orderedYs) {
    const rowRuns = groups.get(y)!.sort((a, b) => a.x - b.x)
    let line = ''
    let prevEndX: number | undefined
    let prevSize = 12
    for (const run of rowRuns) {
      if (prevEndX !== undefined) {
        const gap = run.x - prevEndX
        // An ESTIMATED space (no font metrics say for certain) is marked
        // with a sentinel so the repair pass below can reconsider only
        // this boundary — never a space that was already literally in the
        // source string, which is confident and must not be touched.
        if (gap > 0.25 * prevSize) line += '\u0000'
      }
      line += run.text
      prevEndX = run.x + run.text.length * run.size * 0.5
      prevSize = run.size
    }
    lines.push(repairWordBreaks(line).replace(/\u0000/g, ' '))
  }
  return lines.filter((l) => l.trim().length > 0)
}

/** Rejoin a short fragment to a following lower-case part (Cust+omer -> Customer), never a real short word.
 *  Operates only at ESTIMATED boundaries (the \u0000 sentinel) — a space that was already
 *  literally present in the source string is confident and is never reconsidered. */
function repairWordBreaks(line: string): string {
  return line.replace(/\b([A-Za-z]{1,3})\u0000([a-z]{2,})\b/g, (whole, frag: string, rest: string) => {
    if (STOPWORDS.has(frag.toLowerCase())) return whole
    return `${frag}${rest}`
  })
}

export async function readPdf(bytes: Uint8Array): Promise<PageLines[]> {
  const buf = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const latin1 = buf.toString('latin1')

  const objects = scanObjects(latin1)
  expandObjectStreams(latin1, objects)

  const pageEntries = [...objects.entries()]
    .filter(([, obj]) => /\/Type\s*\/Page\b(?!s)/.test(obj.dict))
    .sort((a, b) => a[0] - b[0])

  if (pageEntries.length === 0) {
    throw new Error('no /Type /Page objects found — not a supported PDF, or it is encrypted (demo scaffold reader)')
  }

  const result: PageLines[] = []
  let totalChars = 0
  let totalTokens = 0
  let singleCharTokens = 0

  pageEntries.forEach(([, pageObj], index) => {
    const contentsMatch = /\/Contents\s+(\d+\s+0\s+R|\[[^\]]*\])/.exec(pageObj.dict)
    const refs = contentsMatch
      ? [...contentsMatch[1].matchAll(/(\d+)\s+0\s+R/g)].map((m) => Number(m[1]))
      : []

    const contentText = refs
      .map((num) => objects.get(num))
      .filter((o): o is RawObject => !!o && o.streamStart !== -1)
      .map((o) => getStreamBytes(latin1, o).toString('latin1'))
      .join('\n')

    const fonts = findFontToUnicodeMaps(latin1, objects, pageObj.dict)
    const runs = extractRunsFromContentStream(contentText, fonts)
    const lines = runsToLines(runs)

    for (const line of lines) {
      totalChars += line.replace(/\s/g, '').length
      for (const token of line.split(/\s+/).filter(Boolean)) {
        totalTokens++
        if (token.length === 1) singleCharTokens++
      }
    }

    result.push({ page: index + 1, lines })
  })

  // Two refusal guards that matter more than the parsing logic above.
  if (totalChars < pageEntries.length * 5) {
    throw new Error(
      `almost no text extracted across ${pageEntries.length} page(s) — this looks like a scan (needs OCR, not a parse bug)`,
    )
  }
  if (totalTokens > 0 && singleCharTokens / totalTokens > 0.4) {
    throw new Error(
      'more than ~40% of tokens are a single character — this looks like a subsetted font with no usable /ToUnicode CMap',
    )
  }

  return result
}
