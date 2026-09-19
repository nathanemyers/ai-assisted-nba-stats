import {
  McpServer,
  ServerContext,
  CallToolResult,
} from '@modelcontextprotocol/server'
import { serveStdio } from '@modelcontextprotocol/server/stdio'

function createServer(): McpServer {
  const server = new McpServer({ name: 'testMCP', version: '1.0.0' })

  server.registerTool(
    'hello_world',
    {
      description: 'Say hello world',
    },
    (ctx: ServerContext): CallToolResult => {
      return { content: [{ type: 'text', text: 'Hello, world!' }] }
    }
  )

  return server
}

serveStdio(createServer)
