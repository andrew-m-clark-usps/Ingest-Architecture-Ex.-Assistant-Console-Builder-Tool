import { test } from 'vitest'
import assert from 'node:assert/strict'
import { extractSlideLines } from '../src/pptx.js'

test('joins <a:t> runs within a paragraph, keeps paragraphs separate', () => {
  const xml = `<p:sld><p:cSld><p:spTree><p:sp><p:txBody>
    <a:p><a:r><a:t>Cust</a:t></a:r><a:r><a:t>omer name</a:t></a:r></a:p>
    <a:p><a:r><a:t>Second paragraph</a:t></a:r></a:p>
  </p:txBody></p:sp></p:spTree></p:cSld></p:sld>`
  const lines = extractSlideLines(xml)
  assert.deepEqual(lines, ['Customer name', 'Second paragraph'])
})

test('decodes XML entities in run text', () => {
  const xml = '<a:p><a:r><a:t>Terms &amp; Conditions</a:t></a:r></a:p>'
  assert.deepEqual(extractSlideLines(xml), ['Terms & Conditions'])
})

test('skips empty paragraphs', () => {
  const xml = '<a:p></a:p><a:p><a:r><a:t>Real line</a:t></a:r></a:p>'
  assert.deepEqual(extractSlideLines(xml), ['Real line'])
})
