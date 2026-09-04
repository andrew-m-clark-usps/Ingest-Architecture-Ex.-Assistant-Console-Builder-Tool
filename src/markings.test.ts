import { describe, expect, it } from 'vitest'
import { detectMarking, mergeMarkings } from './markings.js'
import { generateApplication } from './generate.js'
import { mergeCandidates } from './specMerge.js'
import { genericProfile } from './profiles/generic.js'
import type { Candidate } from './profiles/types.js'
import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

const SAMPLE_CANDIDATES: Candidate[] = [
  { kind: 'endpoint', text: 'Get customer profile', ref: 'api.yaml#1', because: 'endpoint listed in API spec' },
]

async function buildCli() {
  await execFileAsync('node', ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.build.json'])
}

describe('markings', () => {
  it('detects the strongest marking from document header/footer lines', () => {
    const marking = detectMarking(['PUBLIC', 'body text', 'CONFIDENTIAL', 'footer Sensitive'])
    expect(marking).toBe('SENSITIVE')
  })

  it('merges source markings to the strongest value', () => {
    expect(mergeMarkings(['PUBLIC', undefined, 'CONFIDENTIAL'])).toBe('CONFIDENTIAL')
  })

  it('carries classification into generated README and frontend output', () => {
    const corpus = mergeCandidates(SAMPLE_CANDIDATES)
    const { files } = generateApplication(corpus, genericProfile, { classification: 'CONFIDENTIAL' })

    const readme = files.find((file) => file.path === 'README.md')
    const indexHtml = files.find((file) => file.path === 'public/index.html')
    expect(readme?.content).toContain('Classification: CONFIDENTIAL')
    expect(indexHtml?.content).toContain('Classification: CONFIDENTIAL')
  })

  it('refuses writing a marked brief without an explicit confirmation path', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'markings-'))
    try {
      await buildCli()
      const source = join(dir, 'marked.txt')
      const output = join(dir, 'brief.json')
      await writeFile(source, 'CONFIDENTIAL\nAccount Number\n', 'utf-8')

      await expect(execFileAsync('node', ['cli.mjs', source, '--write-brief', output])).rejects.toMatchObject({
        code: 1,
        stderr: expect.stringContaining('--confirm-marked-output'),
      })

      await execFileAsync('node', ['cli.mjs', source, '--write-brief', output, '--confirm-marked-output', output])
      const written = JSON.parse(await readFile(output, 'utf-8')) as { classification: string }
      expect(written.classification).toBe('CONFIDENTIAL')
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})