import { Command } from 'commander'
import chalk from 'chalk'
import axios from 'axios'
import { http } from '../http'

export function makePullCommand(): Command {
  return new Command('pull')
    .argument('<ref>', 'Agent reference in format name@version (e.g. summarizer-agent@1.1.0)')
    .option('-t, --team <team>', 'Your team name (for reuse tracking)')
    .description('Pull an agent manifest from the registry')
    .action(async (ref: string, options: { team?: string }) => {
      const [name, version] = ref.split('@')
      if (!name || !version) {
        console.error(chalk.red('Invalid ref format. Use name@version e.g. summarizer-agent@1.1.0'))
        process.exit(1)
      }

      try {
        const params = options.team ? { team: options.team } : {}
        const res = await http.get(`/agents/${name}/versions/${version}`, { params })
        console.log(chalk.green(`✓ Pulled ${name}@${version}`))
        console.log(JSON.stringify(res.data, null, 2))
      } catch (err: unknown) {
        if (axios.isAxiosError(err) && err.response?.status === 404) {
          console.error(chalk.red(`✗ ${name}@${version} not found in registry`))
          process.exit(1)
        }
        throw err
      }
    })
}
