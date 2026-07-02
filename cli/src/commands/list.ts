import { Command } from 'commander'
import chalk from 'chalk'
import { http } from '../http'

interface CatalogEntry {
  name: string
  latest_version: string
  versions: string[]
  description: string
  author_team: string
  tags: string[]
}

export function makeListCommand(): Command {
  return new Command('list')
    .argument('[name]', 'Agent name to list versions for (omit to list all agents)')
    .description('List agents or versions in the registry')
    .action(async (name?: string) => {
      if (name) {
        const res = await http.get(`/agents/${name}/versions`)
        console.log(chalk.bold(`\n${name}`))
        ;(res.data.versions as string[]).forEach(v => console.log(`  ${v}`))
      } else {
        const res = await http.get('/agents')
        const catalog = res.data as CatalogEntry[]
        if (catalog.length === 0) {
          console.log(chalk.yellow('Registry is empty.'))
          return
        }
        console.log(chalk.bold('\nAgent Registry\n'))
        catalog.forEach(agent => {
          console.log(
            chalk.cyan(`  ${agent.name}`) +
            chalk.gray(`@${agent.latest_version}`) +
            `  — ${agent.description}`
          )
          console.log(chalk.gray(`    team: ${agent.author_team}  versions: ${agent.versions.join(', ')}`))
        })
      }
    })
}
