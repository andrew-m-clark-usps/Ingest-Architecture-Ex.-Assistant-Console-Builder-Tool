import { test } from 'vitest'
import assert from 'node:assert/strict'
import { reconcile } from '../src/reconcile.js'

test('matches labels already held by the newer system', () => {
  const result = reconcile(['Business Name', 'CRID'], ['Business Name', 'CRID', 'ZIP+4'])
  assert.deepEqual(result.alreadyHeld.sort(), ['Business Name', 'CRID'])
})

test('reports a field only the old artifact asks for as still manual', () => {
  const result = reconcile(['Business Name', 'Fax Number'], ['Business Name'])
  assert.deepEqual(result.stillManual, ['Fax Number'])
})

test('reports a field only the newer system holds as newInTarget', () => {
  const result = reconcile(['Business Name'], ['Business Name', 'CRID'])
  assert.deepEqual(result.newInTarget, ['CRID'])
})

test('drops parentheticals before comparing', () => {
  const result = reconcile(['Business Name (Please print)'], ['Business Name'])
  assert.deepEqual(result.alreadyHeld, ['Business Name (Please print)'])
  assert.deepEqual(result.stillManual, [])
})

test('applies an explicit synonym table rather than fuzzy matching', () => {
  const result = reconcile(['Biz Name'], ['Business Name'], { 'biz name': 'business name' })
  assert.deepEqual(result.alreadyHeld, ['Biz Name'])
})

test('does not fuzzy-match Business Name against Business Portal', () => {
  const result = reconcile(['Business Name'], ['Business Portal'])
  assert.deepEqual(result.alreadyHeld, [])
  assert.deepEqual(result.stillManual, ['Business Name'])
})
