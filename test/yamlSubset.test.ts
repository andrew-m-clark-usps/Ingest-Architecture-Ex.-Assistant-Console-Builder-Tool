import { test } from 'vitest'
import assert from 'node:assert/strict'
import { parseYamlSubset, YamlRefused } from '../src/yamlSubset.js'

test('parses a nested map', () => {
  const yaml = `
info:
  title: Claims API
  version: "1.0.0"
`
  const result = parseYamlSubset(yaml) as any
  assert.equal(result.info.title, 'Claims API')
  assert.equal(result.info.version, '1.0.0')
})

test('parses a block sequence of scalars', () => {
  const yaml = `
tags:
  - claims
  - internal
`
  const result = parseYamlSubset(yaml) as any
  assert.deepEqual(result.tags, ['claims', 'internal'])
})

test('parses a block sequence of maps ("- key: value" continued by indented keys)', () => {
  const yaml = `
parameters:
  - name: id
    in: path
    required: true
  - name: filter
    in: query
    required: false
`
  const result = parseYamlSubset(yaml) as any
  assert.equal(result.parameters.length, 2)
  assert.equal(result.parameters[0].name, 'id')
  assert.equal(result.parameters[0].required, true)
  assert.equal(result.parameters[1].name, 'filter')
  assert.equal(result.parameters[1].required, false)
})

test('parses single-line flow collections', () => {
  const yaml = `
enum: [pending, approved, rejected]
inline: {a: 1, b: "two"}
`
  const result = parseYamlSubset(yaml) as any
  assert.deepEqual(result.enum, ['pending', 'approved', 'rejected'])
  assert.deepEqual(result.inline, { a: 1, b: 'two' })
})

test('strips comments outside of quoted strings', () => {
  const yaml = `
title: Claims API # this is a comment
note: "a value with a # inside quotes"
`
  const result = parseYamlSubset(yaml) as any
  assert.equal(result.title, 'Claims API')
  assert.equal(result.note, 'a value with a # inside quotes')
})

test('refuses an anchor', () => {
  assert.throws(() => parseYamlSubset('foo: &anchor bar'), YamlRefused)
})

test('refuses an alias', () => {
  assert.throws(() => parseYamlSubset('foo: *anchor'), YamlRefused)
})

test('refuses a tag', () => {
  assert.throws(() => parseYamlSubset('foo: !!str bar'), YamlRefused)
})

test('refuses a block scalar', () => {
  assert.throws(() => parseYamlSubset('description: |\n  multi\n  line'), YamlRefused)
})

test('refuses multiple documents', () => {
  assert.throws(() => parseYamlSubset('a: 1\n---\nb: 2'), YamlRefused)
})

test('refuses tab indentation', () => {
  assert.throws(() => parseYamlSubset('a:\n\tb: 1'), YamlRefused)
})
