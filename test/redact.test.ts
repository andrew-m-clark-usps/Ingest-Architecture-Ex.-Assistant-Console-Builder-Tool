import { test } from 'vitest'
import assert from 'node:assert/strict'
import { redactHeaders, structureOfJsonBody, dropQueryString, summarizeExchange } from '../capture/redact.mjs'

// See ../Spec-Ingest-Tool.md section 5E: "strip every request and response
// body to its structure before it is written, and never record an
// Authorization header, a cookie, or a Set-Cookie, not even redacted."
// This is the safety-critical logic in the capture script and the only
// part of it testable without a real browser (see capture/README.md).

test('never records an Authorization header, a cookie, or Set-Cookie', () => {
  const result = redactHeaders({
    Authorization: 'Bearer secret-token',
    Cookie: 'session=abc123',
    'Set-Cookie': 'session=abc123; HttpOnly',
    'Content-Type': 'application/json',
  })
  assert.equal(result.Authorization, undefined)
  assert.equal(result.Cookie, undefined)
  assert.equal(result['Set-Cookie'], undefined)
  assert.equal(result['Content-Type'], 'application/json')
})

test('header redaction is case-insensitive', () => {
  const result = redactHeaders({ authorization: 'Bearer x', COOKIE: 'y' })
  assert.deepEqual(result, {})
})

test('a JSON body is reduced to keys, types, and nullability — never values', () => {
  const structure = structureOfJsonBody(JSON.stringify({ businessName: 'Acme Corp', zip: '12345', notes: null }))
  assert.equal(structure.shape, 'object')
  assert.deepEqual(structure.fields.businessName, { type: 'string', nullable: false })
  assert.deepEqual(structure.fields.notes, { type: 'null', nullable: true })
  assert.ok(!JSON.stringify(structure).includes('Acme Corp'))
})

test('an array body reports its item shape and length, not its contents', () => {
  const structure = structureOfJsonBody(JSON.stringify([{ id: 1 }, { id: 2 }]))
  assert.equal(structure.shape, 'array')
  assert.equal(structure.length, 2)
  assert.deepEqual(structure.itemShape.fields.id, { type: 'number', nullable: false })
})

test('an absent body is reported as null, not omitted silently', () => {
  assert.equal(structureOfJsonBody(undefined), null)
})

test('a non-JSON body is reported by shape, not thrown on', () => {
  const structure = structureOfJsonBody('not json{{{')
  assert.equal(structure.shape, 'non-json-or-invalid')
})

test('drops the query string, keeps the path', () => {
  assert.equal(dropQueryString('/addresses/validate?session=abc123'), '/addresses/validate')
})

test('summarizeExchange combines redaction and structure-stripping for one network entry', () => {
  const entry = summarizeExchange({
    url: 'https://example.test/addresses/validate?session=abc',
    method: 'POST',
    requestHeaders: { Authorization: 'Bearer x', 'Content-Type': 'application/json' },
    requestBody: JSON.stringify({ businessName: 'Acme' }),
    status: 422,
    responseHeaders: { 'Set-Cookie': 'a=b' },
    responseBody: JSON.stringify({ error: 'businessName is required' }),
  })
  assert.equal(entry.path, 'https://example.test/addresses/validate')
  assert.equal(entry.status, 422)
  assert.equal(entry.requestHeaders.Authorization, undefined)
  assert.equal(entry.responseHeaders['Set-Cookie'], undefined)
  assert.ok(!JSON.stringify(entry).includes('Acme'))
})
