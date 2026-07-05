import Anthropic from '@anthropic-ai/sdk'
import { AgentManifest } from './manifest'

// Cheap, fast model for eval runs — quality of the "agent" is not what's under test
const EVAL_MODEL = 'claude-haiku-4-5-20251001'

export function buildSystemPrompt(manifest: AgentManifest): string {
  const outputFields = Object.keys(manifest.outputs.properties)
  const outputRequired = manifest.outputs.required ?? []

  return [
    `You are ${manifest.name} v${manifest.version}: ${manifest.description}`,
    `You MUST respond with a valid JSON object containing these fields:`,
    outputRequired.map(f => {
      const def = manifest.outputs.properties[f]
      return `  - "${f}" (${def?.type ?? 'string'}): required`
    }).join('\n'),
    outputFields.filter(f => !outputRequired.includes(f)).map(f => {
      const def = manifest.outputs.properties[f]
      return `  - "${f}" (${def?.type ?? 'string'}): optional`
    }).join('\n'),
    `Respond ONLY with the JSON object. No explanation, no markdown.`
  ].filter(Boolean).join('\n')
}

export async function executeAgent(
  manifest: AgentManifest,
  input: Record<string, unknown>
): Promise<Record<string, unknown> | null> {
  const client = new Anthropic()

  const userMessage = Object.entries(input)
    .map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`)
    .join('\n')

  const response = await client.messages.create({
    model: EVAL_MODEL,
    max_tokens: 1024,
    system: buildSystemPrompt(manifest),
    messages: [{ role: 'user', content: userMessage }]
  })

  const rawText = response.content[0].type === 'text' ? response.content[0].text : ''

  try {
    return JSON.parse(stripMarkdownFences(rawText)) as Record<string, unknown>
  } catch {
    return null // invalid JSON = contract violation
  }
}

// Models sometimes wrap JSON in ```json fences despite instructions
export function stripMarkdownFences(text: string): string {
  return text.trim().replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '')
}
