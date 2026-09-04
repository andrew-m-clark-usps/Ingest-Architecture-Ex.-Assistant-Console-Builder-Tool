import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

let child: ChildProcessWithoutNullStreams
let nextId = 1
let buffer = ''
const pending = new Map<number, (result: unknown) => void>()
const TMP_ROOT = 'test-tmp'

function send(method: string, params?: unknown): Promise<unknown> {
  const id = nextId++
  const request = { jsonrpc: '2.0', id, method, params }
  return new Promise((resolve) => {
    pending.set(id, resolve)
    child.stdin.write(JSON.stringify(request) + '\n')
  })
}

beforeAll(() => {
  child = spawn('node', ['mcp.mjs'])
  child.stdout.on('data', (chunk: Buffer) => {
    buffer += chunk.toString()
    let newlineIndex: number
    while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, newlineIndex)
      buffer = buffer.slice(newlineIndex + 1)
      if (!line.trim()) continue
      const msg = JSON.parse(line)
      pending.get(msg.id)?.(msg.result)
      pending.delete(msg.id)
    }
  })
}, 30_000)

afterAll(() => {
  child.kill()
})

describe('spec-ingest MCP server', () => {
  it('lists the recorded-session inspection tool', async () => {
    const result = (await send('tools/list')) as { tools: { name: string }[] }
    expect(result.tools.some((tool) => tool.name === 'inspect_recorded_session')).toBe(true)
  })

  it('returns inventory and candidates for a safe recorded-session directory', async () => {
    await mkdir(TMP_ROOT, { recursive: true })
    const dir = await mkdtemp(join(TMP_ROOT, 'recorded-session-'))
    try {
      await writeFile(join(dir, 'meta.json'), JSON.stringify({ route: '/gateway?tab=usage', title: 'Gateway' }))
      await writeFile(join(dir, 'fields.json'), JSON.stringify([{ label: 'Account Number' }]))

      const result = (await send('tools/call', {
        name: 'inspect_recorded_session',
        arguments: { path: dir },
      })) as { content: { text: string }[]; isError: boolean }

      expect(result.isError).toBe(false)
      const payload = JSON.parse(result.content[0].text) as {
        inventory: { refusalReasons: string[]; artifacts: Array<{ kind: string }> }
        candidates: Array<{ kind: string; text: string }>
      }
      expect(payload.inventory.refusalReasons).toEqual([])
      expect(payload.inventory.artifacts.map((artifact) => artifact.kind)).toEqual(['fields', 'meta'])
      expect(payload.candidates.some((candidate) => candidate.kind === 'state' && candidate.text.includes('/gateway'))).toBe(true)
      expect(payload.candidates.some((candidate) => candidate.kind === 'field' && candidate.text === 'Account Number')).toBe(true)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('returns a refused inventory for recorded-session secrets without crashing the transport', async () => {
    await mkdir(TMP_ROOT, { recursive: true })
    const dir = await mkdtemp(join(TMP_ROOT, 'recorded-session-'))
    try {
      await writeFile(join(dir, 'requests.json'), JSON.stringify({ headers: { Authorization: 'Bearer abcdefghijklmno' } }))

      const result = (await send('tools/call', {
        name: 'inspect_recorded_session',
        arguments: { path: dir },
      })) as { content: { text: string }[]; isError: boolean }

      expect(result.isError).toBe(false)
      const payload = JSON.parse(result.content[0].text) as {
        inventory: { refusalReasons: string[] }
        refused: boolean
      }
      expect(payload.refused).toBe(true)
      expect(payload.inventory.refusalReasons).toHaveLength(1)
      expect(payload.inventory.refusalReasons[0]).toContain('authorization')
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})