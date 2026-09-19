import { CallToolResult, Client } from '@modelcontextprotocol/client'
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio'
import type { Tool, ToolCall } from 'ollama'
import { getEnv } from '../client/env.js'

let client: Client

const { debug } = getEnv()

function mcpToolToOllamaTool(tool: Partial<CallToolResult>): Tool {
  return {
    type: 'function',
    function: {
      name: tool.name as string,
      description: (tool.description as string) ?? '',
      parameters: tool.inputSchema as Tool['function']['parameters'],
    },
  }
}

function formatToolResult(result: CallToolResult): string {
  const text = result.content
    .map((block) => ('text' in block ? block.text : JSON.stringify(block)))
    .join('\n')
  return result.isError ? `Error: ${text}` : text
}

async function connect(): Promise<Client> {
  const client = new Client({ name: 'hello-world', version: '1.0.0' })

  const transport = new StdioClientTransport({
    command: 'npx',
    args: ['tsx', 'src/MCP/helloWorld/index.ts'],
  })

  await client.connect(transport)
  return client
}

export async function getMCPClient() {
  if (!client) {
    client = await connect()
  }
  return client
}

export async function callMCPTool(
  call: ToolCall,
  args: Record<string, unknown>
) {
  const client = await getMCPClient()
  const MCPResult = await client.callTool({
    name: call.function.name,
    arguments: args,
  })
  const result = formatToolResult(MCPResult)

  if (debug) {
    console.log('MCP Tool result', result)
  }
  return result
}

export async function getMCPTools(): Promise<Tool[]> {
  const client = await getMCPClient()
  const result = await client.listTools()
  return result.tools.map(mcpToolToOllamaTool)
}
