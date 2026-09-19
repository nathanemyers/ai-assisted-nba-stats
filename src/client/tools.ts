// Tool definitions handed to Ollama, plus the dispatcher that actually
// executes them. This is the boundary between "model decides what it
// wants" and "code decides what's allowed to happen."

import type { Tool } from 'ollama'
import { getSchema, runQuery } from '../MCP/nbaElo/db.js'
import { getEnv } from '../env.js'

const { debug } = getEnv()

export const tools: Tool[] = [
  {
    type: 'function',
    function: {
      name: 'get_schema',
      description:
        'Returns the SQL schema (CREATE TABLE / CREATE VIEW statements) of the local NBA SQLite database. Call this first if you do not know the schema of the database.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_database',
      description:
        'Runs a single read-only SQL SELECT query against the local NBA SQLite database and returns the resulting rows as JSON. Only SELECT/WITH statements are allowed - no writes. Results are capped at 200 rows, so aggregate (COUNT/SUM/AVG/GROUP BY) or add LIMIT/ORDER BY rather than pulling raw rows. If you do not know the database schema first call get_schema.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'A single SQLite SELECT statement.',
          },
        },
        required: ['query'],
      },
    },
  },
]

/** Executes a tool call by name and returns a string suitable for a `tool` message's content. */
export async function callTool(name: string, args: unknown): Promise<string> {
  if (debug) {
    console.log('performing tool call: ', name)
    console.log('arguments: ', args)
  }
  try {
    switch (name) {
      case 'get_schema':
        return getSchema()

      case 'query_database': {
        const { query } = (args ?? {}) as { query?: string }
        if (!query) {
          return JSON.stringify({ error: "Missing required argument 'query'." })
        }
        return JSON.stringify(runQuery(query))
      }

      default:
        return JSON.stringify({ error: `Unknown tool: ${name}` })
    }
  } catch (err) {
    return JSON.stringify({
      error: err instanceof Error ? err.message : String(err),
    })
  }
}
