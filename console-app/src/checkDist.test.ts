import { describe, expect, it } from 'vitest'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

describe('check-dist source scan', () => {
  it("finds no fetch/XHR/password-field/AI-SDK reference in this product's own source", async () => {
    await expect(execFileAsync('node', ['scripts/check-dist.mjs'])).resolves.not.toThrow()
  })
})
