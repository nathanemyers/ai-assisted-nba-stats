import { Ollama } from 'ollama'
import type { Message } from 'ollama'
import { tools, callTool } from './tools.js'
import { getSchema } from './db.js'
import defaultConfig from './config.js'
import { getEnv } from './env.js'

const OLLAMA_HOST = process.env.OLLAMA_HOST ?? defaultConfig.ollamaHost
const MAX_TOOL_ITERATIONS = 8

export const MODEL = process.env.OLLAMA_MODEL ?? defaultConfig.model

export const client = new Ollama({ host: OLLAMA_HOST })

export function buildSystemPrompt(): string {
  return `You are a data analyst who answers questions about NBA history using a local SQLite database.

Only trust data returned by the "query_database" tool - never guess numbers from memory. If a question
can't be answered from the schema (e.g. it asks about a season after 2014-15, since that's where this
dataset ends), say so plainly instead of guessing.

Dataset notes:
- Source: FiveThirtyEight's "NBA All Elo" dataset. Covers every NBA/BAA game, 1946-47 through 2014-15.
- Each real game produces TWO rows in "games" (one per team's perspective) - use "games_unique" (is_copy = 0)
  when you want one row per real game instead.
- "season" is the season-ENDING year (season = 1996 means the 1995-96 season).
- A franchise can have multiple team_id/team_name pairs over its history (relocations, renames) - see the
  "teams" view.

Current schema:
${getSchema()}

When you call query_database, write a single SQLite SELECT statement. Prefer aggregating in SQL
(COUNT/SUM/AVG/GROUP BY/ORDER BY/LIMIT) over pulling raw rows, since results are capped at 200 rows.`
}

export interface ToolCallLike {
  function: {
    name: string
    arguments: unknown
  }
}

/**
 * Runs the tool-calling loop on top of an existing message history and
 * returns the model's final plain-text answer. `history` is mutated in
 * place so the caller can keep the running conversation.
 */
export async function ask(history: Message[]): Promise<string> {
  const { debug } = getEnv()
  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    if (debug) {
      const readableHistory = history
        .map((item: Message) => {
          switch (item.role) {
            case 'system': {
              return '>> SYSTEM PROMPT'
            }
            case 'user': {
              return `>> USER: ${item.content}`
            }
            case 'assistant': {
              return `>> AI: ${item.thinking}`
            }
            case 'tool': {
              return `>> TOOL: ${item.content}`
            }
            default: {
              return `>> UNKNOWN: ${item.role}`
            }
          }
        })
        .join('\n')
      console.log(readableHistory)
    }
    const response = await client.chat({
      model: MODEL,
      messages: history,
      tools,
    })

    const message = response.message
    history.push(message)

    const toolCalls = (message as unknown as { tool_calls?: ToolCallLike[] })
      .tool_calls

    if (!toolCalls || toolCalls.length === 0) {
      if (debug) {
        console.log('returning message: ', message)
      }
      return message.content
    }

    for (const call of toolCalls) {
      const args =
        typeof call.function.arguments === 'string'
          ? safeJsonParse(call.function.arguments)
          : call.function.arguments

      const result = await callTool(call.function.name, args)

      history.push({
        role: 'tool',
        content: result,
      } as Message)
    }
  }

  return (
    "I couldn't finish reasoning about that within the tool-call budget " +
    `(${MAX_TOOL_ITERATIONS} round-trips). Try breaking the question into something more specific.`
  )
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return {}
  }
}
