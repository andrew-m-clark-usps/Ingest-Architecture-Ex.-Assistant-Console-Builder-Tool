import { test } from 'vitest'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

// See ../Spec-Ingest-Tool.md section 7A / section 2: "A grep of the
// lockfile for a provider SDK is a build failure." No LLM, and no
// model-provider SDK or API key, anywhere in this tool.

const PROVIDER_SDK_PATTERNS = [
  /@anthropic-ai\//i,
  /\bopenai\b/i,
  /@azure\/openai/i,
  /@google\/generative-ai/i,
  /@google-cloud\/(vertexai|aiplatform)/i,
  /\bcohere-ai\b/i,
  /\breplicate\b/i,
  /@huggingface\/inference/i,
  /langchain/i,
]

async function readIfExists(path: string): Promise<string | undefined> {
  try {
    return await readFile(path, 'utf-8')
  } catch {
    return undefined
  }
}

test('package.json declares no model-provider SDK', async () => {
  const pkg = await readIfExists(join(process.cwd(), 'package.json'))
  assert.ok(pkg, 'package.json must exist')
  for (const pattern of PROVIDER_SDK_PATTERNS) {
    assert.ok(!pattern.test(pkg!), `package.json matched forbidden provider SDK pattern: ${pattern}`)
  }
})

test('package-lock.json (if present) declares no model-provider SDK anywhere in the dependency tree', async () => {
  const lockfile = await readIfExists(join(process.cwd(), 'package-lock.json'))
  if (!lockfile) return // no lockfile yet is not itself a failure
  for (const pattern of PROVIDER_SDK_PATTERNS) {
    assert.ok(!pattern.test(lockfile), `package-lock.json matched forbidden provider SDK pattern: ${pattern}`)
  }
})

test('no provider API key environment variable is referenced in source', async () => {
  const suspiciousVarNames = ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'COHERE_API_KEY', 'GOOGLE_API_KEY']
  const src = await readIfExists(join(process.cwd(), 'src', 'index.ts'))
  const cli = await readIfExists(join(process.cwd(), 'cli.mjs'))
  for (const name of suspiciousVarNames) {
    if (src) assert.ok(!src.includes(name), `src/index.ts references ${name}`)
    if (cli) assert.ok(!cli.includes(name), `cli.mjs references ${name}`)
  }
})
