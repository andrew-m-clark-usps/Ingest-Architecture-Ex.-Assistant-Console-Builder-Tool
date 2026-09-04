// See Spec-Ingest-Tool.md section 5.
//
// Objects are indexed by scanning the WHOLE file for "N G obj ... endobj"
// rather than trusting a single xref table -- linearized or incrementally
// updated PDFs carry multiple xrefs and a naive single-table read misses
// updated objects. Object streams (/ObjStm, mandatory in PDF 1.5+) are
// inflated and their member objects merged into the same object map.
// Text is reconstructed from content-stream operators (BT/ET, Tf, Td/TD/
// Tm/T*, Tj/TJ/'/") using each font's own /ToUnicode CMap; a font with no
// CMap falls back to a literal byte->char mapping (documented limitation,
// not a silent guess about the CMap itself). Two refusal guards are
// mandatory, not optional: near-zero text for the page count means a
// scanned document (OCR needed, not a parse bug); >~40% single-character
// tokens means a subsetted font with no usable CMap.
//
// Decompression uses Node's built-in `node:zlib` -- part of the Node
// runtime, not an npm package in `dependencies`.
import { inflateSync, inflateRawSync } from 'node:zlib'
import { parseCMap, type CMap } from './cmap.js'

export interface PageLines {
  page: number
  lines: string[]
}

// ---------------------------------------------------------------------------
// Low-level dictionary / stream helpers (all operate on latin1-decoded text
// so string indices stay byte-aligned with the original buffer).
// ---------------------------------------------------------------------------

const MAX_INFLATED_STREAM = 50 * 1024 * 1024 // 50 MiB per stream -- decompression-bomb defense

function matchInt(dict: string, key: string): number | undefined {
  const m = dict.match(new RegExp(`/${key}\\s+(\\d+)`))
  return m ? parseInt(m[1], 10) : undefined
}

function matchRef(dict: string, key: string): number | undefined {
  const m = dict.match(new RegExp(`/${key}\\s+(\\d+)\\s+\\d+\\s+R`))
  return m ? parseInt(m[1], 10) : undefined
}

function matchRefArray(dict: string, key: string): number[] {
  const m = dict.match(new RegExp(`/${key}\\s*\\[([^\\]]*)\\]`))
  if (!m) return []
  return [...m[1].matchAll(/(\d+)\s+\d+\s+R/g)].map((x) => parseInt(x[1], 10))
}

function matchInlineDict(dict: string, key: string): string | undefined {
  const start = dict.match(new RegExp(`/${key}\\s*<<`))
  if (!start || start.index === undefined) return undefined
  let i = start.index + start[0].length
  let depth = 1
  const bodyStart = i
  while (i < dict.length && depth > 0) {
    if (dict.startsWith('<<', i)) { depth++; i += 2 }
    else if (dict.startsWith('>>', i)) { depth--; i += 2 }
    else i++
  }
  return dict.slice(bodyStart, i - 2)
}

function inflateMaybe(raw: Buffer, dict: string): Buffer {
  const isFlate = /\/Filter\s*(\/FlateDecode|\[[^\]]*\/FlateDecode)/.test(dict)
  if (!isFlate) return raw
  let out: Buffer
  try {
    out = inflateSync(raw)
  } catch {
    try {
      out = inflateRawSync(raw)
    } catch {
      throw new Error('refused: FlateDecode stream failed to decompress (tried both zlib-wrapped and raw deflate)')
    }
  }
  if (out.length > MAX_INFLATED_STREAM) {
    throw new Error(`refused: decompressed stream exceeds the ${MAX_INFLATED_STREAM} byte cap`)
  }
  return out
}

function resolveStreamEnd(content: string, dict: string, dataStart: number): number {
  const indirectLength = /\/Length\s+\d+\s+\d+\s+R/.test(dict)
  if (!indirectLength) {
    const direct = matchInt(dict, 'Length')
    if (direct !== undefined) {
      const candidateEnd = dataStart + direct
      if (/^\s*endstream/.test(content.slice(candidateEnd, candidateEnd + 24))) return candidateEnd
    }
  }
  // Indirect /Length (or a direct length that didn't line up): find
  // "endstream" and trim exactly one EOL immediately before it.
  const idx = content.indexOf('endstream', dataStart)
  if (idx === -1) throw new Error('refused: stream has no matching endstream marker')
  let end = idx
  if (content[end - 1] === '\n') {
    end -= 1
    if (content[end - 1] === '\r') end -= 1
  }
  return end
}

function getInflatedStream(objContent: string): { dict: string; data: Buffer } | undefined {
  const streamIdx = objContent.indexOf('stream')
  if (streamIdx === -1) return undefined
  const dict = objContent.slice(0, streamIdx)
  let dataStart = streamIdx + 'stream'.length
  if (objContent[dataStart] === '\r') dataStart++
  if (objContent[dataStart] === '\n') dataStart++
  const dataEnd = resolveStreamEnd(objContent, dict, dataStart)
  const raw = Buffer.from(objContent.slice(dataStart, dataEnd), 'latin1')
  return { dict, data: inflateMaybe(raw, dict) }
}

// ---------------------------------------------------------------------------
// Object graph: scan, expand /ObjStm, resolve the page tree.
// ---------------------------------------------------------------------------

function scanObjects(text: string): Map<number, string> {
  const objects = new Map<number, string>()
  const objRe = /(\d+)[ \t]+\d+[ \t]+obj\b/g
  let m: RegExpExecArray | null
  while ((m = objRe.exec(text))) {
    const num = parseInt(m[1], 10)
    const start = objRe.lastIndex
    const end = text.indexOf('endobj', start)
    if (end === -1) continue
    objects.set(num, text.slice(start, end))
  }
  return objects
}

function expandObjectStreams(objects: Map<number, string>): void {
  for (const [, content] of [...objects.entries()]) {
    if (!/\/Type\s*\/ObjStm/.test(content)) continue
    const stream = getInflatedStream(content)
    if (!stream) continue
    const inflatedText = stream.data.toString('latin1')
    const n = matchInt(stream.dict, 'N') ?? 0
    const first = matchInt(stream.dict, 'First') ?? 0
    const header = inflatedText
      .slice(0, first)
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map(Number)
    for (let i = 0; i < n; i++) {
      const objNum = header[i * 2]
      const offset = header[i * 2 + 1]
      if (!Number.isFinite(objNum) || !Number.isFinite(offset)) continue
      const nextOffset = i + 1 < n ? header[(i + 1) * 2 + 1] : inflatedText.length - first
      objects.set(objNum, inflatedText.slice(first + offset, first + nextOffset))
    }
  }
}

function findRootCatalogNum(text: string, objects: Map<number, string>): number | undefined {
  const trailerMatch = text.match(/trailer\s*<<([\s\S]*?)>>/)
  if (trailerMatch) {
    const rootRef = matchRef(trailerMatch[1], 'Root')
    if (rootRef !== undefined && objects.has(rootRef)) return rootRef
  }
  // PDF 1.5+ cross-reference streams fold the trailer into an /XRef
  // object's own dict, with no bare "trailer" keyword -- fall back to
  // finding the catalog directly.
  for (const [num, content] of objects) {
    if (/\/Type\s*\/Catalog/.test(content)) return num
  }
  return undefined
}

function collectPageNums(objects: Map<number, string>, rootCatalogNum: number | undefined): number[] {
  if (rootCatalogNum !== undefined) {
    const catalog = objects.get(rootCatalogNum)
    const pagesRef = catalog ? matchRef(catalog, 'Pages') : undefined
    if (pagesRef !== undefined && objects.has(pagesRef)) {
      const ordered: number[] = []
      const visited = new Set<number>()
      const walk = (num: number, depth: number): void => {
        if (depth > 64 || visited.has(num) || !objects.has(num)) return
        visited.add(num)
        const content = objects.get(num)!
        if (/\/Type\s*\/Pages/.test(content)) {
          for (const kid of matchRefArray(content, 'Kids')) walk(kid, depth + 1)
        } else {
          ordered.push(num)
        }
      }
      walk(pagesRef, 0)
      if (ordered.length > 0) return ordered
    }
  }
  // Fallback: every object with /Type /Page, ascending object-number
  // order. Caveat: this may not match true visual page order when the
  // page tree isn't a simple left-to-right walk.
  return [...objects.entries()]
    .filter(([, content]) => /\/Type\s*\/Page(?!s)/.test(content))
    .map(([num]) => num)
    .sort((a, b) => a - b)
}

function getPageContentText(objects: Map<number, string>, pageNum: number): string {
  const pageContent = objects.get(pageNum)!
  const arrayRefs = matchRefArray(pageContent, 'Contents')
  const singleRef = matchRef(pageContent, 'Contents')
  const contentRefs = arrayRefs.length > 0 ? arrayRefs : singleRef !== undefined ? [singleRef] : []
  let combined = ''
  for (const ref of contentRefs) {
    const streamObjContent = objects.get(ref)
    const stream = streamObjContent ? getInflatedStream(streamObjContent) : undefined
    if (stream) combined += stream.data.toString('latin1') + '\n'
  }
  return combined
}

function getPageFonts(objects: Map<number, string>, pageNum: number): Map<string, CMap | undefined> {
  const pageContent = objects.get(pageNum)!
  let resourcesDict = matchInlineDict(pageContent, 'Resources')
  if (resourcesDict === undefined) {
    const resRef = matchRef(pageContent, 'Resources')
    if (resRef !== undefined) resourcesDict = objects.get(resRef)
  }
  const fonts = new Map<string, CMap | undefined>()
  if (!resourcesDict) return fonts

  let fontDict = matchInlineDict(resourcesDict, 'Font')
  if (fontDict === undefined) {
    const fontRef = matchRef(resourcesDict, 'Font')
    if (fontRef !== undefined) fontDict = objects.get(fontRef)
  }
  if (!fontDict) return fonts

  for (const match of fontDict.matchAll(/\/(\w[\w+\-.]*)\s+(\d+)\s+\d+\s+R/g)) {
    const name = match[1]
    const num = parseInt(match[2], 10)
    const fontObjContent = objects.get(num)
    const cmapRef = fontObjContent ? matchRef(fontObjContent, 'ToUnicode') : undefined
    const cmapObjContent = cmapRef !== undefined ? objects.get(cmapRef) : undefined
    const stream = cmapObjContent ? getInflatedStream(cmapObjContent) : undefined
    fonts.set(name, stream ? parseCMap(stream.data.toString('latin1')) : undefined)
  }
  return fonts
}

// ---------------------------------------------------------------------------
// Content-stream tokenizer.
// ---------------------------------------------------------------------------

type Token =
  | { t: 'num'; v: number }
  | { t: 'str'; v: string }
  | { t: 'name'; v: string }
  | { t: 'array'; v: (number | string)[] }
  | { t: 'op'; v: string }

const DELIMITER_RE = /[\s()<>[\]{}/%]/

function parseLiteralString(s: string, start: number): [string, number] {
  let i = start + 1 // skip '('
  let depth = 1
  let out = ''
  while (i < s.length && depth > 0) {
    const ch = s[i]
    if (ch === '\\') {
      const next = s[i + 1]
      if (next === 'n') { out += '\n'; i += 2 }
      else if (next === 'r') { out += '\r'; i += 2 }
      else if (next === 't') { out += '\t'; i += 2 }
      else if (next === 'b') { out += '\b'; i += 2 }
      else if (next === 'f') { out += '\f'; i += 2 }
      else if (next === '(' || next === ')' || next === '\\') { out += next; i += 2 }
      else if (next === '\n') { i += 2 }
      else if (next === '\r') { i += 2; if (s[i] === '\n') i++ }
      else if (next >= '0' && next <= '7') {
        let oct = ''
        let j = i + 1
        let k = 0
        while (k < 3 && s[j] >= '0' && s[j] <= '7') { oct += s[j]; j++; k++ }
        out += String.fromCharCode(parseInt(oct, 8) & 0xff)
        i = j
      } else { out += next ?? ''; i += 2 }
    } else if (ch === '(') { depth++; out += ch; i++ }
    else if (ch === ')') { depth--; i++; if (depth > 0) out += ch }
    else { out += ch; i++ }
  }
  return [out, i]
}

function parseHexString(s: string, start: number): [string, number] {
  let i = start + 1 // skip '<'
  let hex = ''
  while (i < s.length && s[i] !== '>') {
    if (!/\s/.test(s[i])) hex += s[i]
    i++
  }
  i++ // skip '>'
  if (hex.length % 2 === 1) hex += '0'
  let out = ''
  for (let k = 0; k + 2 <= hex.length; k += 2) out += String.fromCharCode(parseInt(hex.slice(k, k + 2), 16))
  return [out, i]
}

function tokenizeContentStream(s: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  const n = s.length
  while (i < n) {
    const c = s[i]
    if (/\s/.test(c)) { i++; continue }
    if (c === '%') { while (i < n && s[i] !== '\n' && s[i] !== '\r') i++; continue }
    if (c === '(') {
      const [str, next] = parseLiteralString(s, i)
      tokens.push({ t: 'str', v: str })
      i = next
      continue
    }
    if (c === '<' && s[i + 1] === '<') {
      i += 2
      let depth = 1
      while (i < n && depth > 0) {
        if (s.startsWith('<<', i)) { depth++; i += 2 }
        else if (s.startsWith('>>', i)) { depth--; i += 2 }
        else i++
      }
      continue
    }
    if (c === '<') {
      const [str, next] = parseHexString(s, i)
      tokens.push({ t: 'str', v: str })
      i = next
      continue
    }
    if (c === '/') {
      i++
      let name = ''
      while (i < n && !DELIMITER_RE.test(s[i])) { name += s[i]; i++ }
      tokens.push({ t: 'name', v: name })
      continue
    }
    if (c === '[') {
      i++
      const arr: (number | string)[] = []
      while (i < n && s[i] !== ']') {
        if (/\s/.test(s[i])) { i++; continue }
        if (s[i] === '(') {
          const [str, next] = parseLiteralString(s, i)
          arr.push(str)
          i = next
        } else if (s[i] === '<') {
          const [str, next] = parseHexString(s, i)
          arr.push(str)
          i = next
        } else if (/[0-9+\-.]/.test(s[i])) {
          let numStr = ''
          while (i < n && /[0-9+\-.]/.test(s[i])) { numStr += s[i]; i++ }
          const val = parseFloat(numStr)
          if (!Number.isNaN(val)) arr.push(val)
        } else {
          i++
        }
      }
      i++ // skip ']'
      tokens.push({ t: 'array', v: arr })
      continue
    }
    if (/[0-9+\-.]/.test(c)) {
      let numStr = ''
      while (i < n && /[0-9+\-.]/.test(s[i])) { numStr += s[i]; i++ }
      tokens.push({ t: 'num', v: parseFloat(numStr) })
      continue
    }
    let op = ''
    while (i < n && !DELIMITER_RE.test(s[i])) { op += s[i]; i++ }
    if (op.length > 0) tokens.push({ t: 'op', v: op })
    else i++ // stray delimiter (e.g. a lone '{' from a PostScript calculator function) -- skip
  }
  return tokens
}

// ---------------------------------------------------------------------------
// Content-stream interpreter: text position/showing operators only.
// ---------------------------------------------------------------------------

interface RenderState {
  fontName?: string
  fontSize: number
  lines: string[]
  currentLine: string
  currentY?: number
}

function flushLine(state: RenderState): void {
  if (state.currentLine.trim().length > 0) state.lines.push(state.currentLine)
  state.currentLine = ''
}

function showText(raw: string, state: RenderState, fonts: Map<string, CMap | undefined>): void {
  const cmap = state.fontName ? fonts.get(state.fontName) : undefined
  let text = ''
  for (let i = 0; i < raw.length; i++) {
    const code = raw.charCodeAt(i)
    text += cmap?.decode(code) ?? String.fromCharCode(code)
  }
  state.currentLine += text
}

function renderContentStream(tokens: Token[], fonts: Map<string, CMap | undefined>): string[] {
  const state: RenderState = { fontSize: 0, lines: [], currentLine: '' }
  let operands: (number | string | (number | string)[])[] = []

  for (const tok of tokens) {
    if (tok.t !== 'op') {
      operands.push(tok.v)
      continue
    }
    switch (tok.v) {
      case 'BT':
        flushLine(state)
        state.currentY = undefined
        break
      case 'ET':
        flushLine(state)
        break
      case 'Tf':
        state.fontSize = Number(operands[operands.length - 1]) || 0
        state.fontName = String(operands[operands.length - 2] ?? '')
        break
      case 'Td':
      case 'TD': {
        const ty = Number(operands[operands.length - 1]) || 0
        if (ty !== 0 || state.currentY === undefined) flushLine(state)
        state.currentY = (state.currentY ?? 0) + ty
        break
      }
      case 'Tm': {
        const f = Number(operands[operands.length - 1]) || 0
        if (state.currentY === undefined || f !== state.currentY) flushLine(state)
        state.currentY = f
        break
      }
      case 'T*':
        flushLine(state)
        break
      case 'Tj':
        showText(String(operands[operands.length - 1] ?? ''), state, fonts)
        break
      case "'":
        flushLine(state)
        showText(String(operands[operands.length - 1] ?? ''), state, fonts)
        break
      case '"':
        flushLine(state)
        showText(String(operands[operands.length - 1] ?? ''), state, fonts)
        break
      case 'TJ': {
        const arr = (operands[operands.length - 1] as (number | string)[] | undefined) ?? []
        for (const item of arr) {
          if (typeof item === 'number') {
            const displacement = (-item / 1000) * (state.fontSize || 1)
            if (displacement > (state.fontSize || 1) * 0.2 && !state.currentLine.endsWith(' ')) {
              state.currentLine += ' '
            }
          } else {
            showText(item, state, fonts)
          }
        }
        break
      }
      default:
        break
    }
    operands = []
  }
  flushLine(state)
  return state.lines
}

// Word-spacing reconstruction from glyph coordinates has no exact answer.
// This pass only collapses whitespace introduced by the TJ-gap heuristic
// above -- it deliberately never removes a space the content stream
// itself already had, since an over-eager repair risks turning "need to"
// into "needto" (worse than an occasional missed join).
function repairWordSpacing(line: string): string {
  return line.replace(/[ \t]{2,}/g, ' ').trim()
}

// ---------------------------------------------------------------------------
// Public entry point.
// ---------------------------------------------------------------------------

export async function readPdf(bytes: Uint8Array): Promise<PageLines[]> {
  const text = Buffer.from(bytes).toString('latin1')
  const objects = scanObjects(text)
  if (objects.size === 0) {
    throw new Error('refused: no PDF objects found (not a valid PDF, or the file is fully corrupted)')
  }

  expandObjectStreams(objects)

  const rootCatalogNum = findRootCatalogNum(text, objects)
  const pageNums = collectPageNums(objects, rootCatalogNum)
  if (pageNums.length === 0) {
    throw new Error('refused: no pages found in the document structure')
  }

  const pages: PageLines[] = []
  let totalChars = 0
  const allTokensForGuard: string[] = []

  pageNums.forEach((pageNum, index) => {
    const fonts = getPageFonts(objects, pageNum)
    const contentText = getPageContentText(objects, pageNum)
    const tokens = tokenizeContentStream(contentText)
    const lines = renderContentStream(tokens, fonts)
      .map(repairWordSpacing)
      .filter((l) => l.length > 0)
    for (const line of lines) {
      totalChars += line.replace(/\s/g, '').length
      allTokensForGuard.push(...line.split(/\s+/).filter(Boolean))
    }
    pages.push({ page: index + 1, lines })
  })

  // Refusal guard 1 (mandatory): near-zero text for the page count means
  // a scanned document -- OCR needed, not a parse bug.
  const avgCharsPerPage = totalChars / pages.length
  if (avgCharsPerPage < 5) {
    throw new Error(
      `refused: near-empty text (${totalChars} characters across ${pages.length} page(s)) -- ` +
        'this looks like a scanned document needing OCR, not a parse defect',
    )
  }

  // Refusal guard 2 (mandatory): >~40% single-character tokens means a
  // subsetted font with no usable /ToUnicode CMap.
  if (allTokensForGuard.length > 0) {
    const singleCharCount = allTokensForGuard.filter((t) => t.length === 1).length
    const ratio = singleCharCount / allTokensForGuard.length
    if (ratio > 0.4) {
      throw new Error(
        `refused: ${Math.round(ratio * 100)}% single-character tokens -- ` +
          'likely a subsetted font with no usable /ToUnicode CMap',
      )
    }
  }

  return pages
}
