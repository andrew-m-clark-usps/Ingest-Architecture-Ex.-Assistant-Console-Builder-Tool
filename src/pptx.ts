// See ../Spec-Ingest-Tool.md section 4 ("Reading a .pptx"). A regex over
// the raw XML rather than a DOM parser, so this reads identically in a
// browser and a test runner: the job is <a:t> runs, grouped per <a:p>
// paragraph, in document order. A run break inside a paragraph is a
// formatting change (e.g. one word turned bold), not a line break —
// joining the runs is what reconstructs the original sentence.

import { readZipEntries } from './unzip.js'

export interface SlideLines {
  slide: number
  lines: string[]
}

const SLIDE_PATH = /^ppt\/slides\/slide(\d+)\.xml$/

function slideNumber(name: string): number {
  const m = SLIDE_PATH.exec(name)
  return m ? Number(m[1]) : Number.MAX_SAFE_INTEGER
}

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
}

/** Extract lines from one slide's raw XML: <a:t> runs joined per <a:p>. */
export function extractSlideLines(xml: string): string[] {
  const lines: string[] = []
  // <a:p ...>...</a:p>, non-greedy so adjacent paragraphs stay separate.
  const paragraphRe = /<a:p\b[^>]*>([\s\S]*?)<\/a:p>/g
  const runTextRe = /<a:t\b[^>]*>([\s\S]*?)<\/a:t>/g

  let pMatch: RegExpExecArray | null
  while ((pMatch = paragraphRe.exec(xml)) !== null) {
    const paragraphXml = pMatch[1]
    let joined = ''
    let tMatch: RegExpExecArray | null
    runTextRe.lastIndex = 0
    while ((tMatch = runTextRe.exec(paragraphXml)) !== null) {
      joined += decodeXmlEntities(tMatch[1])
    }
    if (joined.trim().length > 0) lines.push(joined)
  }
  return lines
}

export async function readPptx(bytes: Uint8Array): Promise<SlideLines[]> {
  const entries = await readZipEntries(bytes)
  const slideEntries = entries
    .filter((e) => SLIDE_PATH.test(e.name))
    .sort((a, b) => slideNumber(a.name) - slideNumber(b.name))

  if (slideEntries.length === 0) {
    throw new Error(
      'no ppt/slides/slideN.xml entries found — is this a .pptx file? (demo scaffold reader)',
    )
  }

  const decoder = new TextDecoder('utf-8')
  return slideEntries.map((entry) => ({
    slide: slideNumber(entry.name),
    lines: extractSlideLines(decoder.decode(entry.data)),
  }))
}
