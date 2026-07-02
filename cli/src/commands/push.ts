import { Command } from 'commander'
import fs from 'fs'
import chalk from 'chalk'
import axios from 'axios'
import { http } from '../http'

export function makePushCommand(): Command {
  return new Command('push')
    .argument('<file>', 'Path to agent manifest YAML file')
    .option('-t, --team <team>', 'Pushing team name')
    .description('Publish an agent manifest to the registry')
    .action(async (file: string, options: { team?: string }) => {
      if (!fs.existsSync(file)) {
        console.error(chalk.red(`File not found: ${file}`))
        process.exit(1)
      }

      const yamlContent = fs.readFileSync(file, 'utf-8')

      try {
        const res = await http.post('/agents', {
          yaml: yamlContent,
          pushing_team: options.team ?? 'unknown'
        })
        console.log(chalk.green(`✓ ${res.data.message}`))
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
