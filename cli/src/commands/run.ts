import { Command } from 'commander'
import chalk from 'chalk'
import Anthropic from '@anthropic-ai/sdk'
import { http } from '../http'

interface ManifestInputs {
  required?: string[]
  properties: Record<string, { type: string; description?: string }>
}

interface ManifestOutputs {
  required?: string[]
  properties: Record<string, { type: string; description?: string }>
}

interface AgentManifest {
  name: string
  version: string
  description: string
  model_recommendations?: string[]
  inputs: ManifestInputs
  outputs: ManifestOutputs
}

export function makeRunCommand(): Command {
  return new Command('run')
    .argument('<ref>', 'Agent reference in format name@version')
    .requiredOption('-i, --input <json>', 'Input JSON string matching the manifest input schema')
    .description('Run an agent using its manifest contract — calls Claude with the declared schema')
    .action(async (ref: string, options: { input: string }) => {
      const [name, version] = ref.split('@')
      if (!name || !version) {
        console.error(chalk.red('Invalid ref. Use name@version'))
        process.exit(1)
      }

      // 1. Pull manifest from registry
      let manifest: AgentManifest
      try {
        const res = await http.get(`/agents/${name}/versions/${version}`)
        manifest = res.data as AgentManifest
      } catch {
        console.error(chalk.red(`✗ Could not pull ${name}@${version} from registry`))
        process.exit(1)
      }

      // 2. Parse and validate input
      let input: Record<string, unknown>
      try {
        input = JSON.parse(options.input)
      } catch {
        console.error(chalk.red('✗ Invalid JSON input'))
        process.exit(1)
      }

      const required = manifest.inputs.required ?? []
      const missing = required.filter(f => !(f in input))
      if (missing.length > 0) {
        console.error(chalk.red(`✗ Missing required inputs: ${missing.join(', ')}`))
        process.exit(1)
      }

      // 3. Build prompt from manifest contract
      const model = manifest.model_recommendations?.[0] ?? 'claude-sonnet-4-6'
      const outputFields = Object.keys(manifest.outputs.properties)
      const outputRequired = manifest.outputs.required ?? []

      const systemPrompt = [
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

      const userMessage = Object.entries(input)
        .map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`)
        .join('\n')

      // 4. Call Claude
      console.log(chalk.gray(`\nRunning ${name}@${version} with model ${model}...\n`))

      const client = new Anthropic()
      const response = await client.messages.create({
        model,
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }]
      })

      const rawText = response.content[0].type === 'text' ? response.content[0].text : ''

      // 5. Parse and display output
      try {
        const output = JSON.parse(rawText)
        console.log(chalk.green(`✓ ${name}@${version} responded:\n`))
        console.log(JSON.stringify(output, null, 2))
      } catch {
        console.log(chalk.yellow('Response (raw):'))
        console.log(rawText)
      }
    })
}
