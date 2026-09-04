// See Spec-Ingest-Tool.md section 5: "the deterministic path must stand
// alone. --no-ml runs the whole tool with every ML-backed step disabled,
// and every deterministic candidate must be byte-identical either way."
// There is no ML/inference path in this tool yet -- this test still
// pins the invariant now, so it fails loudly the moment one is added
// without preserving it.
import { describe, expect, it } from 'vitest'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { writeFile, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const execFileAsync = promisify(execFile)

describe('--no-ml determinism', () => {
  it('produces byte-identical --coverage output with and without --no-ml', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'no-ml-'))
    const filePath = join(dir, 'sample.txt')
    try {
      await writeFile(filePath, 'This system must retain records for at least five years.\n', 'utf-8')

      const withFlag = await execFileAsync('node', ['cli.mjs', filePath, '--coverage', '--no-ml'])
      const withoutFlag = await execFileAsync('node', ['cli.mjs', filePath, '--coverage'])

      expect(withFlag.stdout).toBe(withoutFlag.stdout)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})
