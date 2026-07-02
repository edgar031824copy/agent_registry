import { Command } from 'commander'
import chalk from 'chalk'
import { http } from '../http'

// Mirrors EvalDelta/EvalEntryDelta from server/src/eval.ts (no cross-workspace import to keep rootDir clean)
interface EvalEntryDelta {
  id: string
  baseline_score: number | null
  target_score: number | null
  delta: number | null
  status: 'improved' | 'regressed' | 'unchanged' | 'new' | 'removed'
}

interface EvalDelta {
  baseline_version: string
  target_version: string
  overall_baseline: number | null
  overall_target: number | null
  overall_delta: number | null
  entries: EvalEntryDelta[]
}

export function makeEvalCommand(): Command {
  return new Command('eval')
    .argument('<ref>', 'Target version ref (name@version)')
    .requiredOption('-b, --baseline <version>', 'Baseline version to compare against')
    .description('Show eval delta between two agent versions')
    .action(async (ref: string, options: { baseline: string }) => {
      const [name, version] = ref.split('@')
      if (!name || !version) {
        console.error(chalk.red('Invalid ref. Use name@version'))
        process.exit(1)
      }

      const res = await http.get(`/agents/${name}/${version}/eval-delta`, {
        params: { baseline: options.baseline }
      })
      const delta = res.data as EvalDelta

      console.log(chalk.bold(`\nEval Delta: ${name}@${delta.baseline_version} → @${delta.target_version}\n`))

      const overallDir = delta.overall_delta !== null
        ? delta.overall_delta > 0 ? chalk.green(`▲ +${delta.overall_delta}`) : chalk.red(`▼ ${delta.overall_delta}`)
        : chalk.gray('N/A')

      console.log(`Overall score: ${delta.overall_baseline} → ${delta.overall_target}  ${overallDir}\n`)

      delta.entries.forEach((e: EvalEntryDelta) => {
        const icon = e.status === 'improved' ? chalk.green('▲') :
                     e.status === 'regressed' ? chalk.red('▼') :
                     e.status === 'new' ? chalk.blue('+') :
                     e.status === 'removed' ? chalk.gray('-') : chalk.gray('=')
        const scores = e.baseline_score !== null && e.target_score !== null
          ? `${e.baseline_score} → ${e.target_score} (${e.delta! > 0 ? '+' : ''}${e.delta})`
          : e.status === 'new' ? `new: ${e.target_score}` : `removed: ${e.baseline_score}`
        console.log(`  ${icon} ${e.id.padEnd(30)} ${scores}`)
      })
    })
}
