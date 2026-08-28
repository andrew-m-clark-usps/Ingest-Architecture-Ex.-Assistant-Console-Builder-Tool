import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { runTwinning } from './twinning.mjs'

// From Exec-Assistant.md Appendix A3 -- the same function as twinning.mjs,
// exposed to an agent. It never duplicates the logic.

const server = new Server(
  { name: 'twinning', version: '1.0.0' },
  { capabilities: { tools: {} } },
)

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'run_twinning',
      description:
        'Drive a legacy page and its rebuild through the same flow and compare a named value, console errors and element count.',
      inputSchema: {
        type: 'object',
        properties: {
          legacyUrl: { type: 'string' },
          modernUrl: { type: 'string' },
          legacy: { type: 'object', description: 'fill, click, read selectors for the legacy side' },
          modern: { type: 'object', description: 'fill, click, read selectors for the rebuild' },
          screenshots: { type: 'boolean' },
          elementDrift: { type: 'number' },
        },
        required: ['legacyUrl', 'modernUrl', 'legacy', 'modern'],
      },
    },
  ],
}))

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name !== 'run_twinning') {
    throw new Error(`unknown tool: ${request.params.name}`)
  }
  const result = await runTwinning(request.params.arguments)
  return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
})

await server.connect(new StdioServerTransport())
