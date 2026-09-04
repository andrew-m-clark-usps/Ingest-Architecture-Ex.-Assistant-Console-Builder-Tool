import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import { spawn, execSync, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { standardizeAddress } from './lib/addressStandardizer'
import { aggregateLedger } from './lib/ledger'
import { SAMPLE_LEDGER_TRANSACTIONS } from './lib/sampleData'

// See ../../Console.md section 6 (MCP tool parity): the MCP tool result
// and the UI's own domain-core call must agree, because they call the
// exact same lib function -- this test proves that end to end through
// the real bundled server, not just by re-reading the source.

let child: ChildProcessWithoutNullStreams
let nextId = 1
let buffer = ''
const pending = new Map<number, (result: unknown) => void>()

function send(method: string, params?: unknown): Promise<unknown> {
  const id = nextId++
  const request = { jsonrpc: '2.0', id, method, params }
  return new Promise((resolve) => {
    pending.set(id, resolve)
    child.stdin.write(JSON.stringify(request) + '\n')
  })
}

beforeAll(() => {
  // A single, fully-literal command string (no untrusted input) run via
  // the default shell -- avoids the Windows `.cmd` EINVAL that
  // execFileSync hits without a shell, and the args-array + shell:true
  // deprecation warning that execFileSync(..., { shell: true }) trips.
  execSync('npm run build:mcp', { stdio: 'ignore' })
  child = spawn('node', ['dist-mcp/server.mjs'])
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

describe('Console MCP server', () => {
  it('lists the 4 domain-core tools', async () => {
    const result = (await send('tools/list')) as { tools: { name: string }[] }
    expect(result.tools.map((t) => t.name).sort()).toEqual([
      'audit_change_of_address',
      'meter_usage',
      'score_ledger',
      'standardize_address',
    ])
  })

  it('standardize_address agrees with the UI-side standardizeAddress call', async () => {
    const input = { deliveryLine: '123 Key West Blvd', city: 'Austin', state: 'TX', zip5: '78701' }
    const uiResult = standardizeAddress(input)

    const result = (await send('tools/call', { name: 'standardize_address', arguments: input })) as {
      content: { text: string }[]
      isError: boolean
    }
    expect(result.isError).toBe(false)
    const mcpResult = JSON.parse(result.content[0].text)
    expect(mcpResult).toEqual(uiResult)
  })

  it('score_ledger agrees with the UI-side aggregateLedger call', async () => {
    const uiResult = aggregateLedger(SAMPLE_LEDGER_TRANSACTIONS)

    const result = (await send('tools/call', {
      name: 'score_ledger',
      arguments: { transactions: SAMPLE_LEDGER_TRANSACTIONS },
    })) as { content: { text: string }[]; isError: boolean }
    expect(result.isError).toBe(false)
    const mcpResult = JSON.parse(result.content[0].text)
    expect(mcpResult).toEqual(uiResult)
  })

  it('refuses an unknown tool by name, as a tool result rather than a crash', async () => {
    const result = (await send('tools/call', { name: 'not_a_real_tool', arguments: {} })) as {
      content: { text: string }[]
      isError: boolean
    }
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('unknown tool')
  })
})
