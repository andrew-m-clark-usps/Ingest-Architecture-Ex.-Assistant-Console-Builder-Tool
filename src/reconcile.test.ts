import { describe, expect, it } from 'vitest'
import { reconcile } from './reconcile.js'

describe('reconcile', () => {
  it('matches an old field to a new field via exact normalized label', () => {
    const result = reconcile(['Account Number'], ['Account Number', 'Customer Name'])
    expect(result.alreadyHeld).toEqual(['Account Number'])
    expect(result.newInTarget).toEqual(['Customer Name'])
    expect(result.stillManual).toEqual([])
  })

  it('matches via the synonym table', () => {
    const result = reconcile(['ZIP Code'], ['zip5'])
    expect(result.alreadyHeld).toEqual(['ZIP Code'])
    expect(result.newInTarget).toEqual([])
  })

  it('puts an unmatched old field into stillManual', () => {
    const result = reconcile(['Legacy Notes Field'], ['Account Number'])
    expect(result.stillManual).toEqual(['Legacy Notes Field'])
    expect(result.newInTarget).toEqual(['Account Number'])
  })

  it('ignores parentheticals when normalizing', () => {
    const result = reconcile(['Account Number (internal)'], ['Account Number'])
    expect(result.alreadyHeld).toEqual(['Account Number (internal)'])
  })

  it('does not fuzzy-match a clearly different label', () => {
    const result = reconcile(['Account Number'], ['Accounts Numbered'])
    expect(result.stillManual).toEqual(['Account Number'])
    expect(result.newInTarget).toEqual(['Accounts Numbered'])
  })
})
