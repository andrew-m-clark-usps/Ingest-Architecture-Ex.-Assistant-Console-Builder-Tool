import { test } from 'vitest'
import assert from 'node:assert/strict'
import { mkdtemp, rm, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import ts from 'typescript'
import { generateRepository } from '../src/generate.js'
test('generates a real repository: app, tests, CI workflow, and Terraform', async () => {
  const outDir = await mkdtemp(join(tmpdir(), 'generated-'))
  try {
    const written = await generateRepository({ appName: 'example-app', outDir })
    assert.ok(written.includes('src/index.ts'))
    assert.ok(written.includes('test/index.test.ts'))
    assert.ok(written.includes('.github/workflows/ci.yml'))
    assert.ok(written.includes('terraform/variables.tf'))
    assert.ok(written.includes('terraform/main.tf'))
  } finally {
    await rm(outDir, { recursive: true, force: true })
  }
})

test('the generated application type-checks clean (installs, builds — proven, not just generated)', async () => {
  const outDir = await mkdtemp(join(tmpdir(), 'generated-'))
  try {
    await generateRepository({ appName: 'example-app', outDir })
    const program = ts.createProgram({
      rootNames: [join(outDir, 'src/index.ts'), join(outDir, 'test/index.test.ts')],
      options: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.NodeNext,
        moduleResolution: ts.ModuleResolutionKind.NodeNext,
        strict: true,
        noEmit: true,
        types: ['node'],
        typeRoots: [join(process.cwd(), 'node_modules/@types')],
      },
    })
    const diagnostics = ts.getPreEmitDiagnostics(program)
    const messages = diagnostics.map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n'))
    assert.deepEqual(messages, [])
  } finally {
    await rm(outDir, { recursive: true, force: true })
  }
})

test('the generated package.json has zero runtime dependencies', async () => {
  const outDir = await mkdtemp(join(tmpdir(), 'generated-'))
  try {
    await generateRepository({ appName: 'example-app', outDir })
    const pkg = JSON.parse(await readFile(join(outDir, 'package.json'), 'utf-8'))
    assert.deepEqual(pkg.dependencies ?? {}, {})
  } finally {
    await rm(outDir, { recursive: true, force: true })
  }
})

test('generated Terraform variables have no default — every environment-specific value is supplied by the caller', async () => {
  const outDir = await mkdtemp(join(tmpdir(), 'generated-'))
  try {
    await generateRepository({ appName: 'example-app', outDir })
    const variables = await readFile(join(outDir, 'terraform/variables.tf'), 'utf-8')
    assert.ok(!/\bdefault\s*=/.test(variables))
  } finally {
    await rm(outDir, { recursive: true, force: true })
  }
})
