import { AgentManifest, EvalEntry } from './manifest'

export interface EvalEntryDelta {
  id: string
  baseline_score: number | null
  target_score: number | null
  delta: number | null
  status: 'improved' | 'regressed' | 'unchanged' | 'new' | 'removed'
}

export interface EvalDelta {
  baseline_version: string
  target_version: string
  overall_baseline: number | null
  overall_target: number | null
  overall_delta: number | null
  entries: EvalEntryDelta[]
}

function average(scores: number[]): number | null {
  if (scores.length === 0) return null
  return parseFloat((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(4))
}

export function computeEvalDelta(baseline: AgentManifest, target: AgentManifest): EvalDelta {
  const baselineEntries = new Map<string, EvalEntry>(
    (baseline.eval_suite ?? []).map(e => [e.id, e])
  )
  const targetEntries = new Map<string, EvalEntry>(
    (target.eval_suite ?? []).map(e => [e.id, e])
  )

  const allIds = new Set([...baselineEntries.keys(), ...targetEntries.keys()])
  const entries: EvalEntryDelta[] = []

  for (const id of allIds) {
    const b = baselineEntries.get(id)
    const t = targetEntries.get(id)

    if (b && t) {
      const delta = parseFloat((t.score - b.score).toFixed(4))
      entries.push({
        id,
        baseline_score: b.score,
        target_score: t.score,
        delta,
        status: delta > 0.01 ? 'improved' : delta < -0.01 ? 'regressed' : 'unchanged'
      })
    } else if (!b && t) {
      entries.push({ id, baseline_score: null, target_score: t.score, delta: null, status: 'new' })
    } else if (b && !t) {
      entries.push({ id, baseline_score: b.score, target_score: null, delta: null, status: 'removed' })
    }
  }

  const baselineScores = entries.filter(e => e.baseline_score !== null).map(e => e.baseline_score!)
  const targetScores = entries.filter(e => e.target_score !== null).map(e => e.target_score!)
  const ob = average(baselineScores)
  const ot = average(targetScores)

  return {
    baseline_version: baseline.version,
    target_version: target.version,
    overall_baseline: ob,
    overall_target: ot,
    overall_delta: ob !== null && ot !== null ? parseFloat((ot - ob).toFixed(4)) : null,
    entries
  }
}
