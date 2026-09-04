// See ../Console.md section 6 (MCP tool parity): expose read-only tools
// wired to the SAME domain-core functions the pages use, so a tool
// result and what a person sees in the console can never drift apart.
// JSON-RPC over stdio, no SDK -- same shape as the other two products'
// MCP servers in this repo. Lives outside src/ so `tsc -b` (scoped to
// src/ via tsconfig.app.json) never type-checks a Node-only entry point
// against the browser project; esbuild (see package.json's build:mcp)
// bundles and transpiles it independently.
import { createInterface } from 'node:readline'
import { standardizeAddress, type AddressInput } from '../src/lib/addressStandardizer.js'
import { aggregateLedger, type LedgerTransaction } from '../src/lib/ledger.js'
import { meterUsageEvents, computeInvoice, type UsageEvent, type IpAgreement } from '../src/lib/usageMetering.js'
import { auditChangeOfAddressRecord, type ChangeOfAddressRecord, type ReturnCodeDef } from '../src/lib/changeOfAddressAudit.js'
import { RETURN_CODES } from '../src/lib/referenceData.js'

const TOOLS = [
  { name: 'standardize_address', description: 'Standardize a delivery address against Publication 28 rules.' },
  { name: 'score_ledger', description: 'Aggregate ledger transactions into balance-over-time, totals, and per-account summaries.' },
  { name: 'meter_usage', description: 'Meter usage events against IP agreements and compute the projected invoice for a month.' },
  { name: 'audit_change_of_address', description: 'Audit change-of-address records against the return-code reference table.' },
]

interface ToolResult {
  content: { type: 'text'; text: string }[]
  isError: boolean
}

function respond(id: unknown, result: unknown): void {
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, result }) + '\n')
}

function toolResult(text: string, isError = false): ToolResult {
  return { content: [{ type: 'text', text }], isError }
}

function callTool(name: string, args: Record<string, unknown>): ToolResult {
  switch (name) {
    case 'standardize_address': {
      const input = args as unknown as AddressInput
      if (!input?.deliveryLine) {
        throw new Error('standardize_address requires "deliveryLine", "city", "state", "zip5"')
      }
      return toolResult(JSON.stringify(standardizeAddress(input)))
    }
    case 'score_ledger': {
      const transactions = args.transactions as LedgerTransaction[]
      if (!Array.isArray(transactions)) throw new Error('score_ledger requires "transactions" (array)')
      return toolResult(JSON.stringify(aggregateLedger(transactions)))
    }
    case 'meter_usage': {
      const events = args.events as UsageEvent[]
      const agreements = args.agreements as IpAgreement[]
      const month = args.month as string | undefined
      if (!Array.isArray(events) || !Array.isArray(agreements)) {
        throw new Error('meter_usage requires "events" and "agreements" (arrays)')
      }
      const metered = meterUsageEvents(events, agreements)
      const invoices = month ? computeInvoice(metered, agreements, month) : undefined
      return toolResult(JSON.stringify({ metered, invoices }))
    }
    case 'audit_change_of_address': {
      const records = args.records as ChangeOfAddressRecord[]
      const returnCodes = (args.returnCodes as ReturnCodeDef[] | undefined) ?? RETURN_CODES
      if (!Array.isArray(records)) throw new Error('audit_change_of_address requires "records" (array)')
      const findings = records.map((r) => ({ id: r.id, findings: auditChangeOfAddressRecord(r, returnCodes) }))
      return toolResult(JSON.stringify(findings))
    }
    default:
      throw new Error(`unknown tool: ${name}`)
  }
}

const rl = createInterface({ input: process.stdin })

rl.on('line', (line) => {
  let msg: { id?: unknown; method?: string; params?: { name?: string; arguments?: Record<string, unknown> } }
  try {
    msg = JSON.parse(line)
  } catch {
    return
  }
  if (msg.method === 'initialize') {
    respond(msg.id, {
      protocolVersion: '2024-11-05',
      capabilities: { tools: {} },
      serverInfo: { name: 'addressing-console', version: '0.2.0' },
    })
  } else if (msg.method === 'tools/list') {
    respond(msg.id, { tools: TOOLS })
  } else if (msg.method === 'tools/call') {
    const { name, arguments: args } = msg.params ?? {}
    try {
      respond(msg.id, callTool(name ?? '', args ?? {}))
    } catch (err) {
      respond(msg.id, toolResult(err instanceof Error ? err.message : String(err), true))
    }
  }
  // notifications/initialized needs no response
})
