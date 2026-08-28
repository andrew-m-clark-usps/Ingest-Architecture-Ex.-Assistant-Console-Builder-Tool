import { test } from 'vitest'
import assert from 'node:assert/strict'
import { parseCMap } from '../src/cmap.js'

test('beginbfchar maps single codes to single characters', () => {
  const stream = `
    2 beginbfchar
    <30> <004D>
    <31> <0061>
    endbfchar
  `
  const cmap = parseCMap(stream)
  assert.equal(cmap.decode(0x30), 'M')
  assert.equal(cmap.decode(0x31), 'a')
  assert.equal(cmap.decode(0x99), undefined)
})

test('beginbfrange contiguous form increments the destination', () => {
  const stream = `
    1 beginbfrange
    <0041> <0043> <0061>
    endbfrange
  `
  const cmap = parseCMap(stream)
  assert.equal(cmap.decode(0x41), 'a')
  assert.equal(cmap.decode(0x42), 'b')
  assert.equal(cmap.decode(0x43), 'c')
})

test('beginbfrange explicit array form maps each code independently', () => {
  const stream = `
    1 beginbfrange
    <10> <12> [<0058> <0059> <005A>]
    endbfrange
  `
  const cmap = parseCMap(stream)
  assert.equal(cmap.decode(0x10), 'X')
  assert.equal(cmap.decode(0x11), 'Y')
  assert.equal(cmap.decode(0x12), 'Z')
})

test('bfchar can map one code to a multi-character string', () => {
  const stream = `
    1 beginbfchar
    <20> <00410042>
    endbfchar
  `
  const cmap = parseCMap(stream)
  assert.equal(cmap.decode(0x20), 'AB')
})
