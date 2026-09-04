import { describe, expect, it } from 'vitest'
import { readPptx } from './pptx.js'
import { buildStoredZip } from './testZipFixture.js'

function slideXml(paragraphs: string[]): string {
  const body = paragraphs
    .map((p) => `<a:p>${p}</a:p>`)
    .join('')
  return `<?xml version="1.0"?><p:sld xmlns:a="a"><p:cSld><p:spTree><p:sp><p:txBody>${body}</p:txBody></p:sp></p:spTree></p:cSld></p:sld>`
}

describe('readPptx', () => {
  it('extracts text runs joined per paragraph, in slide order', async () => {
    const slide1 = slideXml(['<a:r><a:t>Hello </a:t></a:r><a:r><a:t>World</a:t></a:r>', '<a:r><a:t>Second line</a:t></a:r>'])
    const slide2 = slideXml(['<a:r><a:t>Slide two</a:t></a:r>'])
    const zip = buildStoredZip([
      { name: 'ppt/slides/slide2.xml', data: new TextEncoder().encode(slide2) },
      { name: 'ppt/slides/slide1.xml', data: new TextEncoder().encode(slide1) },
      { name: '[Content_Types].xml', data: new TextEncoder().encode('<x/>') },
    ])

    const slides = await readPptx(zip)

    expect(slides).toEqual([
      { slide: 1, lines: ['Hello World', 'Second line'] },
      { slide: 2, lines: ['Slide two'] },
    ])
  })

  it('decodes XML entities in run text', async () => {
    const slide = slideXml(['<a:r><a:t>Fees &amp; charges &lt;total&gt;</a:t></a:r>'])
    const zip = buildStoredZip([{ name: 'ppt/slides/slide1.xml', data: new TextEncoder().encode(slide) }])

    const slides = await readPptx(zip)

    expect(slides[0].lines).toEqual(['Fees & charges <total>'])
  })

  it('refuses a zip with no slide parts', async () => {
    const zip = buildStoredZip([{ name: 'README.txt', data: new TextEncoder().encode('not a pptx') }])
    await expect(readPptx(zip)).rejects.toThrow(/no ppt\/slides/)
  })
})
