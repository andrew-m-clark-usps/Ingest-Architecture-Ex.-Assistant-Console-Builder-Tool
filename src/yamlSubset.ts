// See ../Spec-Ingest-Tool.md section 6A: "YAML without a dependency... a
// full YAML implementation is a large dependency with a long history of
// parser bugs." Implements the subset OpenAPI/Swagger specifications are
// actually written in: nested maps, sequences, plain and quoted scalars,
// single-line flow collections, and comments. Everything else — anchors,
// aliases, tags, block scalars, multiple documents, tab indentation — is
// refused BY NAME rather than partly parsed, because a partly-parsed
// specification reads as correct and nobody re-reads a spec they believe
// already parsed.

export type YamlValue = string | number | boolean | null | YamlValue[] | { [key: string]: YamlValue }

class YamlRefused extends Error {}

interface Line {
  indent: number
  content: string
  lineNumber: number
}

function stripComment(line: string): string {
  let inSingle = false
  let inDouble = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === "'" && !inDouble) inSingle = !inSingle
    else if (ch === '"' && !inSingle) inDouble = !inDouble
    else if (ch === '#' && !inSingle && !inDouble && (i === 0 || /\s/.test(line[i - 1]))) {
      return line.slice(0, i)
    }
  }
  return line
}

function refuseUnsupportedConstructs(raw: string): void {
  const rawLines = raw.split('\n')
  let seenContent = false
  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i]
    const n = i + 1
    if (/^\t| \t|\t /.test(line)) {
      throw new YamlRefused(`line ${n}: tab indentation is not supported by this YAML subset`)
    }
    const trimmed = line.trim()
    if (trimmed === '---') {
      // A leading "---" (no real content before it) is a harmless single-
      // document marker. One appearing after content means a second
      // document has started, which this subset does not support.
      if (seenContent) throw new YamlRefused(`line ${n}: multiple YAML documents are not supported`)
      continue
    }
    if (trimmed === '...') {
      throw new YamlRefused(`line ${n}: multiple YAML documents are not supported`)
    }
    if (trimmed !== '') seenContent = true
    // An anchor follows a key as often as it opens a line: match both.
    if (/(^|:\s)&\w+/.test(line)) {
      throw new YamlRefused(`line ${n}: YAML anchors are not supported`)
    }
    if (/(^|:\s|\s)\*\w+/.test(line) && !/https?:\/\//.test(line)) {
      throw new YamlRefused(`line ${n}: YAML aliases are not supported`)
    }
    if (/!!\w+/.test(line)) {
      throw new YamlRefused(`line ${n}: YAML tags are not supported`)
    }
    if (/:\s*[|>][+-]?\s*$/.test(line)) {
      throw new YamlRefused(`line ${n}: YAML block scalars (| or >) are not supported`)
    }
  }
}

function parseScalar(text: string): YamlValue {
  const t = text.trim()
  if (t === '' || t === '~' || t === 'null' || t === 'Null' || t === 'NULL') return null
  if (t === 'true' || t === 'True' || t === 'TRUE') return true
  if (t === 'false' || t === 'False' || t === 'FALSE') return false
  if (/^"(?:[^"\\]|\\.)*"$/.test(t)) return JSON.parse(t)
  if (/^'(?:[^']|'')*'$/.test(t)) return t.slice(1, -1).replace(/''/g, "'")
  if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t)
  if (t.startsWith('[') || t.startsWith('{')) return parseFlow(t)
  return t
}

/** A single-line flow collection: [a, b, c] or {a: 1, b: "two"}. */
function parseFlow(text: string): YamlValue {
  const t = text.trim()
  if (t.startsWith('[')) {
    const inner = t.slice(1, t.lastIndexOf(']'))
    if (inner.trim() === '') return []
    return splitFlowItems(inner).map((item) => parseScalar(item))
  }
  if (t.startsWith('{')) {
    const inner = t.slice(1, t.lastIndexOf('}'))
    const result: Record<string, YamlValue> = {}
    if (inner.trim() === '') return result
    for (const item of splitFlowItems(inner)) {
      const idx = splitKeyColon(item)
      if (idx === -1) continue
      const key = item.slice(0, idx).trim().replace(/^["']|["']$/g, '')
      result[key] = parseScalar(item.slice(idx + 1))
    }
    return result
  }
  return parseScalar(t)
}

function splitFlowItems(inner: string): string[] {
  const items: string[] = []
  let depth = 0
  let inSingle = false
  let inDouble = false
  let current = ''
  for (const ch of inner) {
    if (ch === "'" && !inDouble) inSingle = !inSingle
    else if (ch === '"' && !inSingle) inDouble = !inDouble
    if (!inSingle && !inDouble) {
      if (ch === '[' || ch === '{') depth++
      if (ch === ']' || ch === '}') depth--
      if (ch === ',' && depth === 0) {
        items.push(current)
        current = ''
        continue
      }
    }
    current += ch
  }
  if (current.trim() !== '') items.push(current)
  return items
}

function splitKeyColon(line: string): number {
  let inSingle = false
  let inDouble = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === "'" && !inDouble) inSingle = !inSingle
    else if (ch === '"' && !inSingle) inDouble = !inDouble
    else if (ch === ':' && !inSingle && !inDouble && (i + 1 === line.length || /\s/.test(line[i + 1]))) {
      return i
    }
  }
  return -1
}

function toLines(raw: string): Line[] {
  return raw
    .split('\n')
    .map((l, i) => ({ raw: stripComment(l), lineNumber: i + 1 }))
    .filter(({ raw }) => raw.trim() !== '' && raw.trim() !== '---')
    .map(({ raw, lineNumber }) => ({
      indent: raw.length - raw.trimStart().length,
      content: raw.trim(),
      lineNumber,
    }))
}

function parseBlock(lines: Line[], start: number, indent: number): [YamlValue, number] {
  if (start >= lines.length || lines[start].indent < indent) return [null, start]

  if (lines[start].content.startsWith('- ') || lines[start].content === '-') {
    const arr: YamlValue[] = []
    let i = start
    while (i < lines.length && lines[i].indent === indent && (lines[i].content === '-' || lines[i].content.startsWith('- '))) {
      const rest = lines[i].content === '-' ? '' : lines[i].content.slice(2)
      if (rest === '') {
        if (i + 1 < lines.length && lines[i + 1].indent > indent) {
          const [value, next] = parseBlock(lines, i + 1, lines[i + 1].indent)
          arr.push(value)
          i = next
        } else {
          arr.push(null)
          i++
        }
      } else if (splitKeyColon(rest) !== -1) {
        // "- key: value" starts an inline map continued by more-indented keys below.
        const inlineIndent = lines[i].indent + (lines[i].content.length - rest.length)
        const syntheticLines: Line[] = [{ indent: inlineIndent, content: rest, lineNumber: lines[i].lineNumber }]
        let j = i + 1
        while (j < lines.length && lines[j].indent >= inlineIndent) {
          syntheticLines.push(lines[j])
          j++
        }
        const [value] = parseBlock(syntheticLines, 0, inlineIndent)
        arr.push(value)
        i = j
      } else {
        arr.push(parseScalar(rest))
        i++
      }
    }
    return [arr, i]
  }

  const obj: Record<string, YamlValue> = {}
  let i = start
  while (i < lines.length && lines[i].indent === indent) {
    const colonIdx = splitKeyColon(lines[i].content)
    if (colonIdx === -1) {
      throw new YamlRefused(`line ${lines[i].lineNumber}: expected "key: value", got "${lines[i].content}"`)
    }
    const key = lines[i].content.slice(0, colonIdx).trim().replace(/^["']|["']$/g, '')
    const rest = lines[i].content.slice(colonIdx + 1).trim()
    if (rest === '') {
      if (i + 1 < lines.length && lines[i + 1].indent > indent) {
        const [value, next] = parseBlock(lines, i + 1, lines[i + 1].indent)
        obj[key] = value
        i = next
      } else {
        obj[key] = null
        i++
      }
    } else {
      obj[key] = parseScalar(rest)
      i++
    }
  }
  return [obj, i]
}

export function parseYamlSubset(raw: string): YamlValue {
  refuseUnsupportedConstructs(raw)
  const lines = toLines(raw)
  if (lines.length === 0) return null
  const baseIndent = lines[0].indent
  const [value] = parseBlock(lines, 0, baseIndent)
  return value
}

export { YamlRefused }
