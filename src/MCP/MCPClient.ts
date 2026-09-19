import { CallToolResult, Client } from '@modelcontextprotocol/client'
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio'
import type { Tool, ToolCall } from 'ollama'
import { getEnv } from '../client/env.js'
import { manifest, MCPServerConfig } from './stdioManifest.js'

const { debug } = getEnv()

interface ClientEntry {
  name: string
  client: Client
}
let clientList: ClientEntry[] = []

async function initializeMCPClients(): Promise<ClientEntry[]> {
  const clients = await Promise.all(
    manifest.map(async (server) => {
      const client = await connect(server)
      return {
        name: server.name,
        client,
      }
    })
  )

  return clients
}

export async function lookupMCPTool(
  toolName: string
): Promise<string | undefined> {
  const clientList = await getMCPClients()

  for (const clientEntry of clientList) {
    const tools = await clientEntry.client.listTools()
    if (tools.tools.find((tool) => tool.name === toolName)) {
      return clientEntry.name
    }
  }
  return undefined
}

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

async function connect(server: MCPServerConfig): Promise<Client> {
  const client = new Client({ name: server.name, version: server.version })

  const transport = new StdioClientTransport({
    command: 'npx',
    args: ['tsx', server.path],
  })

  await client.connect(transport)
  return client
}

export async function getMCPClients() {
  if (clientList.length === 0) {
    clientList = await initializeMCPClients()
  }
  return clientList
}

export async function callMCPTool(
  clientName: string,
  call: ToolCall,
  args: Record<string, unknown>
) {
  const clientList = await getMCPClients()
  const clientEntry = clientList.find(
    (clientEntry) => clientEntry.name === clientName
  )

  if (!clientEntry) {
    throw new Error(`Unable to lookup client with name: ${clientName}`)
  }

  const MCPResult = await clientEntry.client.callTool({
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
  const clientList = await getMCPClients()
  const result = await Promise.all(
    clientList.map(async (clientEntry) => {
      const { tools } = await clientEntry.client.listTools()
      return tools.map(mcpToolToOllamaTool)
    })
  )
  return result.flat()
}
