import { test } from 'vitest'
import assert from 'node:assert/strict'
import { parseOpenApiSource, classifyOpenApi, isOpenApiDocument } from '../src/openapi.js'

const SPEC = `
openapi: "3.0.0"
info:
  title: Claims API
  version: "1.0.0"
paths:
  /claims/{id}:
    get:
      operationId: getClaim
      parameters:
        - name: id
          in: path
          schema:
            type: string
      responses:
        "200":
          description: OK
        "404":
          description: Not found
    post:
      operationId: createClaim
      deprecated: true
      security: []
      requestBody:
        content:
          application/json:
            schema:
              type: object
              required: [claimant]
              properties:
                claimant:
                  type: string
                amount:
                  type: number
      responses:
        "201":
          description: Created
        "422":
          description: Validation error
components:
  securitySchemes:
    bearerAuth:
      type: http
`

test('claims a document only when it declares an openapi/swagger version', () => {
  const doc = parseOpenApiSource(SPEC, false)
  assert.equal(isOpenApiDocument(doc), true)
  assert.equal(isOpenApiDocument({ title: 'not a spec' }), false)
})

test('every operation becomes its own endpoint candidate, keyed by METHOD /path', () => {
  const doc = parseOpenApiSource(SPEC, false)
  const candidates = classifyOpenApi(doc, 'claims.yaml')
  const endpoints = candidates.filter((c) => c.kind === 'endpoint').map((c) => c.text)
  assert.deepEqual(endpoints.sort(), ['GET /claims/{id}', 'POST /claims/{id}'])
})

test('a path parameter is required whether or not it says so', () => {
  const doc = parseOpenApiSource(SPEC, false)
  const candidates = classifyOpenApi(doc, 'claims.yaml')
  const param = candidates.find((c) => c.text.includes('param id'))!
  assert.match(param.text, /required/)
})

test('every 4xx/5xx response becomes a rule; success responses do not', () => {
  const doc = parseOpenApiSource(SPEC, false)
  const candidates = classifyOpenApi(doc, 'claims.yaml')
  const rules = candidates.filter((c) => c.kind === 'rule').map((c) => c.text)
  assert.ok(rules.some((r) => r.includes('-> 404')))
  assert.ok(rules.some((r) => r.includes('-> 422')))
  assert.ok(!rules.some((r) => r.includes('-> 200')))
  assert.ok(!rules.some((r) => r.includes('-> 201')))
})

test('deprecated and security:[] are recorded as decisions', () => {
  const doc = parseOpenApiSource(SPEC, false)
  const candidates = classifyOpenApi(doc, 'claims.yaml')
  const rules = candidates.filter((c) => c.kind === 'rule').map((c) => c.text)
  assert.ok(rules.some((r) => r.includes('is deprecated')))
  assert.ok(rules.some((r) => r.includes('disables security')))
})

test('request body fields are transcribed with type and requiredness', () => {
  const doc = parseOpenApiSource(SPEC, false)
  const candidates = classifyOpenApi(doc, 'claims.yaml')
  const claimant = candidates.find((c) => c.text.includes('body.claimant'))!
  assert.match(claimant.text, /required/)
  const amount = candidates.find((c) => c.text.includes('body.amount'))!
  assert.match(amount.text, /optional/)
})

test('security schemes are recorded as rules', () => {
  const doc = parseOpenApiSource(SPEC, false)
  const candidates = classifyOpenApi(doc, 'claims.yaml')
  assert.ok(candidates.some((c) => c.kind === 'rule' && c.text.includes('bearerAuth')))
})

test('throws a clear error for a document with no openapi/swagger key', () => {
  const doc = parseOpenApiSource('title: just a config file\nvalue: 1', false)
  assert.throws(() => classifyOpenApi(doc, 'config.yaml'), /openapi.*swagger/i)
})
