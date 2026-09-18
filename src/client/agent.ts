import { Ollama } from 'ollama'
import type { Message } from 'ollama'
import { tools, callTool } from './tools.js'
import defaultConfig from './config.js'
import { getEnv } from './env.js'

const OLLAMA_HOST = process.env.OLLAMA_HOST ?? defaultConfig.ollamaHost
const MAX_TOOL_ITERATIONS = 8

export const MODEL = process.env.OLLAMA_MODEL ?? defaultConfig.model

export const client = new Ollama({ host: OLLAMA_HOST })

function formatMessage(msg: Message) {
  switch (msg.role) {
    case 'system': {
      return '>> SYSTEM PROMPT'
    }
    case 'user': {
      return `>> USER: ${msg.content}`
    }
    case 'assistant': {
      return `>> AI: ${msg.thinking}`
    }
    case 'tool': {
      return `>> TOOL: ${msg.content}`
    }
    default: {
      return `>> UNKNOWN: ${msg.role}`
    }
  }
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
    const response = await client.chat({
      model: MODEL,
      messages: history,
      tools,
    })

    const message = response.message
    if (debug) {
      console.log(formatMessage(message))
    }
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
