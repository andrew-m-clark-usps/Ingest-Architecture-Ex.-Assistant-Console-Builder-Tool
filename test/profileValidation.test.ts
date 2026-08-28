import { test } from 'vitest'
import assert from 'node:assert/strict'
import { validateProfile } from '../src/profiles/types.js'
import { genericProfile } from '../src/profiles/generic.js'
import type { Profile } from '../src/profiles/types.js'

test('the generic profile validates cleanly', () => {
  assert.doesNotThrow(() => validateProfile(genericProfile))
})

test('the generic profile contains no domain-specific vocabulary', () => {
  const bannedWords = ['crid', 'usps', 'ncoa', 'zip+4', 'permit']
  const haystack = JSON.stringify(genericProfile).toLowerCase()
  for (const word of bannedWords) {
    assert.ok(!haystack.includes(word), `generic profile mentions domain-specific term "${word}"`)
  }
})

test('rejects a profile with no sections', () => {
  const profile: Profile = { id: 'empty', name: 'Empty', description: '', sections: [] }
  assert.throws(() => validateProfile(profile), /no sections/)
})

test('rejects a section listing no source kinds', () => {
  const profile: Profile = {
    id: 'bad',
    name: 'Bad',
    description: '',
    sections: [{ section: '1', title: 'Screens', kinds: [], from: ['document'], fill: 'x' }],
  }
  assert.throws(() => validateProfile(profile), /no source kinds/)
})

test('rejects a section declaring no "from"', () => {
  const profile: Profile = {
    id: 'bad2',
    name: 'Bad2',
    description: '',
    sections: [{ section: '1', title: 'Screens', kinds: ['field'], from: [], fill: 'x' }],
  }
  assert.throws(() => validateProfile(profile), /from/)
})
