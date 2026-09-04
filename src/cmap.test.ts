import { describe, expect, it } from 'vitest'
import { parseCMap } from './cmap.js'

describe('parseCMap', () => {
  it('decodes beginbfchar/endbfchar single-code pairs', () => {
    const cmap = parseCMap(`
      1 beginbfchar
      <0041> <0041>
      <0042> <0042>
      endbfchar
    `)
    expect(cmap.decode(0x41)).toBe('A')
    expect(cmap.decode(0x42)).toBe('B')
    expect(cmap.decode(0x99)).toBeUndefined()
  })

  it('decodes the contiguous beginbfrange form (only the last hex unit increments)', () => {
    const cmap = parseCMap(`
      1 beginbfrange
      <0041> <0043> <0061>
      endbfrange
    `)
    expect(cmap.decode(0x41)).toBe('a')
    expect(cmap.decode(0x42)).toBe('b')
    expect(cmap.decode(0x43)).toBe('c')
  })

  it('decodes the explicit-array beginbfrange form', () => {
    const cmap = parseCMap(`
      1 beginbfrange
      <0010> <0012> [<0041> <0042> <0043>]
      endbfrange
    `)
    expect(cmap.decode(0x10)).toBe('A')
    expect(cmap.decode(0x11)).toBe('B')
    expect(cmap.decode(0x12)).toBe('C')
  })

  it('decodes multi-unit destinations as multi-character strings', () => {
    const cmap = parseCMap('1 beginbfchar\n<0020> <00410042>\nendbfchar')
    expect(cmap.decode(0x20)).toBe('AB')
  })
})
