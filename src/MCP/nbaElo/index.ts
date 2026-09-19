import {
  McpServer,
  ServerContext,
  CallToolResult,
} from '@modelcontextprotocol/server'
import { serveStdio } from '@modelcontextprotocol/server/stdio'
import { getSchema, runQuery } from './db.js'
import { getEnv } from '../../env.js'
import zod from 'zod/v4'

const { debug } = getEnv()

function createServer(): McpServer {
  const server = new McpServer({ name: 'nbaElo', version: '1.0.0' })

  server.registerTool(
    'get_schema',
    {
      description:
        'Returns the SQL schema (CREATE TABLE / CREATE VIEW statements) of the local NBA SQLite database. Call this first if you do not know the schema of the database.',
    },
    () => {
      const schema = getSchema()
      return { content: [{ type: 'text', text: schema }] }
    }
  )

  server.registerTool(
    'query_database',
    {
      inputSchema: zod.object({
        query: zod.string().describe('A single SQLite SELECT statement.'),
      }),
      description:
        'Runs a single read-only SQL SELECT query against the local NBA SQLite database and returns the resulting rows as JSON. Only SELECT/WITH statements are allowed - no writes. Results are capped at 200 rows, so aggregate (COUNT/SUM/AVG/GROUP BY) or add LIMIT/ORDER BY rather than pulling raw rows. If you do not know the database schema first call get_schema.',
    },
    ({ query }) => {
      const results = runQuery(query)
      return { content: [{ type: 'text', text: JSON.stringify(results) }] }
    }
  )

  return server
}

serveStdio(createServer)

/** Executes a tool call by name and returns a string suitable for a `tool` message's content. */
// export async function callTool(name: string, args: unknown): Promise<string> {
//   if (debug) {
//     console.log('performing tool call: ', name)
//     console.log('arguments: ', args)
//   }
//   try {
//     switch (name) {
//       case 'get_schema':
//         return getSchema()

//       case 'query_database': {
//         const { query } = (args ?? {}) as { query?: string }
//         if (!query) {
//           return JSON.stringify({ error: "Missing required argument 'query'." })
//         }
//         return JSON.stringify(runQuery(query))
//       }

//       default:
//         return JSON.stringify({ error: `Unknown tool: ${name}` })
//     }
//   } catch (err) {
//     return JSON.stringify({
//       error: err instanceof Error ? err.message : String(err),
//     })
//   }
// }
