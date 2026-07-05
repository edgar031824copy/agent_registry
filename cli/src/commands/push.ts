import { Command } from 'commander'
import fs from 'fs'
import chalk from 'chalk'
import axios from 'axios'
import { http } from '../http'

export function makePushCommand(): Command {
  return new Command('push')
    .argument('<file>', 'Path to agent manifest YAML file')
    .option('-t, --team <team>', 'Pushing team name')
    .option('-e, --eval', 'Run the eval suite live on the server and store computed scores')
    .description('Publish an agent manifest to the registry')
    .action(async (file: string, options: { team?: string; eval?: boolean }) => {
      if (!fs.existsSync(file)) {
        console.error(chalk.red(`File not found: ${file}`))
        process.exit(1)
      }

      const yamlContent = fs.readFileSync(file, 'utf-8')

      try {
        if (options.eval) console.log(chalk.gray('Running eval suite on the registry (live Claude calls)...'))
        const res = await http.post('/agents', {
          yaml: yamlContent,
          pushing_team: options.team ?? 'unknown',
          run_evals: options.eval === true
        })
        console.log(chalk.green(`✓ ${res.data.message}`))
        const evalResults = res.data.eval_results as
          | { id: string; score: number; passed: boolean; missing_fields: string[]; declared_score: number }[]
          | undefined
        if (evalResults) {
          console.log(chalk.bold('\nEval results (computed by registry):'))
          evalResults.forEach(r => {
            const icon = r.passed ? chalk.green('✓') : chalk.red('✗')
            const declared = r.score !== r.declared_score ? chalk.gray(` (declared: ${r.declared_score})`) : ''
            const missing = r.missing_fields.length ? chalk.red(`  missing: ${r.missing_fields.join(', ')}`) : ''
            console.log(`  ${icon} ${r.id.padEnd(20)} score: ${r.score}${declared}${missing}`)
          })
        }
      } catch (err: unknown) {
        if (axios.isAxiosError(err) && err.response) {
          const data = err.response.data as { error: string; breaking_changes?: { field: string; reason: string }[] }
          console.error(chalk.red(`✗ Push rejected: ${data.error}`))
          if (data.breaking_changes?.length) {
            console.error(chalk.yellow('\nBreaking changes detected:'))
            data.breaking_changes.forEach(bc => {
              console.error(chalk.yellow(`  • [${bc.field}] ${bc.reason}`))
            })
          }
          process.exit(1)
        }
        throw err
      }
    })
}
