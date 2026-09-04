// See Spec-Ingest-Tool.md section 3 (zero runtime dependencies) and
// section 5 ("a grep of the lockfile for a provider SDK is a build
// failure"). This test enforces that as a CI-checkable rule rather than
// a promise -- it fails if a model-provider package ever lands in this
// project's package.json or package-lock.json.
import { describe, expect, it } from 'vitest'
import { readFile } from 'node:fs/promises'

// Known model-provider SDK package name fragments. Not exhaustive by
// design -- new entries should be added here as they're discovered,
// same as any other supply-chain denylist.
const BANNED_PACKAGE_FRAGMENTS = [
  'openai',
  '@anthropic-ai',
  '@google/generative-ai',
  '@google-cloud/vertexai',
  'cohere-ai',
  '@azure/openai',
  'langchain',
  '@huggingface',
  'ollama',
]

describe('no model-provider SDK in this project (root, not tools/)', () => {
  it('package.json has an empty "dependencies" section', async () => {
    const pkg = JSON.parse(await readFile('package.json', 'utf-8'))
    expect(pkg.dependencies ?? {}).toEqual({})
  })

  it('package-lock.json names no known model-provider package', async () => {
    const lock = await readFile('package-lock.json', 'utf-8')
    const lowered = lock.toLowerCase()
    for (const fragment of BANNED_PACKAGE_FRAGMENTS) {
      expect(lowered.includes(fragment.toLowerCase())).toBe(false)
    }
  })

  it('package.json names no known model-provider package anywhere (dependencies or devDependencies)', async () => {
    const pkg = JSON.parse(await readFile('package.json', 'utf-8'))
    const allDeps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) }
    for (const name of Object.keys(allDeps)) {
      for (const fragment of BANNED_PACKAGE_FRAGMENTS) {
        expect(name.toLowerCase().includes(fragment.toLowerCase())).toBe(false)
      }
    }
  })
})
