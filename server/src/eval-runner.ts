import { AgentManifest } from './manifest'
import { executeAgent } from './agent-executor'

export interface EvalRunResult {
  id: string
  score: number
  passed: boolean
  missing_fields: string[]
  declared_score: number
}

// Runs each eval_suite case against Claude and computes the score:
// fraction of expected_output_contains fields present in the returned JSON
// (0 if the response is not valid JSON at all).
export async function runEvalSuite(manifest: AgentManifest): Promise<EvalRunResult[]> {
  const results: EvalRunResult[] = []

  for (const entry of manifest.eval_suite ?? []) {
    const output = await executeAgent(manifest, entry.input)
    const expected = entry.expected_output_contains

    let missing: string[]
    if (output === null) {
      missing = [...expected]
    } else {
      missing = expected.filter(f => !(f in output))
    }

    const score = expected.length === 0
      ? 1
      : parseFloat(((expected.length - missing.length) / expected.length).toFixed(4))

    results.push({
      id: entry.id,
      score,
      passed: missing.length === 0,
      missing_fields: missing,
      declared_score: entry.score
    })
  }

  return results
}

// Returns a copy of the manifest with computed scores written into eval_suite
export function applyComputedScores(manifest: AgentManifest, results: EvalRunResult[]): AgentManifest {
  const byId = new Map(results.map(r => [r.id, r.score]))
  return {
    ...manifest,
    eval_suite: (manifest.eval_suite ?? []).map(e => ({
      ...e,
      score: byId.get(e.id) ?? e.score
    }))
  }
}
