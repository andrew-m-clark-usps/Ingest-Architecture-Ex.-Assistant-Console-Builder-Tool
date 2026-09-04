// See Spec-Ingest-Tool.md section 4.
//
// A .pptx is a ZIP of XML parts. Rather than pull in a DOM/XML parser
// (and its XXE/billion-laughs attack surface) this reads slide text with
// a regex over `<a:t>` runs grouped by `<a:p>` paragraph -- a run break
// inside a paragraph is a formatting boundary, not a line break, so runs
// within one paragraph are joined without an inserted space unless the
// source text already had one.
import { readZipEntries } from './unzip.js'

export interface SlideLines {
  slide: number
  lines: string[]
}

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
}

function decodeXmlEntities(text: string): string {
  // The /i flag already makes matching case-insensitive, so a single
  // `a-f` range covers both cases -- `a-fA-F` would be a duplicate range.
  return text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity: string) => {
    if (entity.startsWith('#')) {
      const isHex = entity[1] === 'x' || entity[1] === 'X'
      const code = isHex ? Number.parseInt(entity.slice(2), 16) : Number.parseInt(entity.slice(1), 10)
      return Number.isFinite(code) ? String.fromCodePoint(code) : match
    }
    return ENTITIES[entity.toLowerCase()] ?? match
  })
}

function extractSlideLines(xml: string): string[] {
  const lines: string[] = []
  const paragraphs = xml.match(/<a:p>[\s\S]*?<\/a:p>/g) ?? []
  for (const paragraph of paragraphs) {
    const runs = [...paragraph.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map((m) => decodeXmlEntities(m[1]))
    const line = runs.join('')
    if (line.trim().length > 0) lines.push(line)
  }
  return lines
}

export async function readPptx(bytes: Uint8Array): Promise<SlideLines[]> {
  const entries = await readZipEntries(bytes)
  const decoder = new TextDecoder('utf-8')

  const slideEntries = entries
    .map((entry) => {
      const match = /^ppt\/slides\/slide(\d+)\.xml$/.exec(entry.name)
      return match ? { slide: Number.parseInt(match[1], 10), entry } : undefined
    })
    .filter((x): x is { slide: number; entry: (typeof entries)[number] } => x !== undefined)
    .sort((a, b) => a.slide - b.slide)

  if (slideEntries.length === 0) {
    throw new Error('refused: no ppt/slides/slideN.xml parts found (not a valid .pptx)')
  }

  return slideEntries.map(({ slide, entry }) => ({
    slide,
    lines: extractSlideLines(decoder.decode(entry.data)),
  }))
}
