import { describe, expect, it } from 'vitest'
import { mkdtemp, rm, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import {
  generateApplication,
  generateBackend,
  generateFrontend,
  generateTerraform,
  writeGeneratedFiles,
} from './generate.js'
import { mergeCandidates } from './specMerge.js'
import { genericProfile } from './profiles/generic.js'
import type { Candidate } from './profiles/types.js'

const execFileAsync = promisify(execFile)

const SAMPLE_CANDIDATES: Candidate[] = [
  { kind: 'endpoint', text: 'Get customer profile', ref: 'api.yaml#1', because: 'endpoint listed in API spec' },
  { kind: 'endpoint', text: 'List orders', ref: 'api.yaml#2', because: 'endpoint listed in API spec' },
  { kind: 'field', text: 'Account Number', ref: 'doc.pdf#3', because: 'short title-case line' },
  { kind: 'heading', text: 'CUSTOMER SCREEN', ref: 'doc.pdf#4', because: 'all-caps heading' },
]

describe('generateBackend', () => {
  it('turns endpoint/record candidates into deduplicated 501-stub routes', () => {
    const corpus = mergeCandidates(SAMPLE_CANDIDATES)
    const [file] = generateBackend(corpus)
    expect(file.path).toBe('server.mjs')
    expect(file.content).toContain("'GET /api/get-customer-profile'")
    expect(file.content).toContain("'GET /api/list-orders'")
    expect(file.content).toContain('501')
  })

  it('never emits an unused request parameter on the 501 handler', () => {
    const corpus = mergeCandidates(SAMPLE_CANDIDATES)
    const [file] = generateBackend(corpus)
    // requestListener(req, res) uses both params -- req via req.method/req.url.
    expect(file.content).toMatch(/req\.method/)
    expect(file.content).toMatch(/req\.url/)
  })
})

describe('generateFrontend', () => {
  it('renders no <script>, no on* attribute, and no <style> block/attribute', () => {
    const corpus = mergeCandidates(SAMPLE_CANDIDATES)
    const [indexHtml] = generateFrontend(corpus, genericProfile)
    expect(indexHtml.content).not.toMatch(/<script/i)
    expect(indexHtml.content).not.toMatch(/\bon[a-z]+\s*=/i)
    expect(indexHtml.content).not.toMatch(/<style/i)
  })

  it('lists field/heading candidates under the Screens section', () => {
    const corpus = mergeCandidates(SAMPLE_CANDIDATES)
    const [indexHtml] = generateFrontend(corpus, genericProfile)
    expect(indexHtml.content).toContain('Account Number')
    expect(indexHtml.content).toContain('CUSTOMER SCREEN')
  })
})

describe('generateTerraform', () => {
  it('never hardcodes an account ID, region, or other environment-specific value', () => {
    const files = generateTerraform(genericProfile)
    const combined = files.map((f) => f.content).join('\n')
    // No 12-digit AWS account ID literal, no hardcoded common region string.
    expect(combined).not.toMatch(/\b\d{12}\b/)
    expect(combined).not.toMatch(/"us-(east|west)-\d"/)
    expect(combined).toContain('variable "aws_region"')
    expect(combined).toContain('variable "aws_account_id"')
    expect(combined).toContain('variable "state_bucket"')
  })

  it('declares every variable with no default', () => {
    const [variablesTf] = generateTerraform(genericProfile)
    expect(variablesTf.content).not.toMatch(/default\s*=/)
  })
})

describe('generateApplication end-to-end (writes to disk and actually runs)', () => {
  it('installs, builds, and runs -- not just exists as files', async () => {
    const corpus = mergeCandidates(SAMPLE_CANDIDATES)
    const { files } = generateApplication(corpus, genericProfile)
    const outDir = await mkdtemp(join(tmpdir(), 'generated-app-'))
    try {
      await writeGeneratedFiles(outDir, files)

      // "Exists as files" check.
      const pkg = JSON.parse(await readFile(join(outDir, 'package.json'), 'utf-8'))
      expect(pkg.name).toBeTruthy()

      // "Runs" check: the generated app's own zero-dependency test
      // suite actually passes when executed for real. `node --test`
      // with no path argument relies on Node's default test-file
      // discovery (test/**/*.test.mjs), which is more portable across
      // Node versions than passing an explicit directory argument.
      const { stdout, stderr } = await execFileAsync('node', ['--test'], { cwd: outDir })
      const combinedOutput = stdout + stderr
      expect(combinedOutput).toMatch(/pass 3/) // 1 404 test + 2 route stub tests
      expect(combinedOutput).not.toMatch(/fail [1-9]/)
    } finally {
      await rm(outDir, { recursive: true, force: true })
    }
  }, 30_000)
})
