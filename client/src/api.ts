// Local dev: '/api' → Vite proxy to :3001. Production: Vercel injects the Render URL at build time.
const BASE = import.meta.env.VITE_API_URL ?? '/api'

export interface CatalogEntry {
  name: string
  latest_version: string
  versions: string[]
  description: string
  author_team: string
  tags: string[]
}

export interface AgentManifest {
  name: string
  version: string
  description: string
  author_team: string
  model_recommendations?: string[]
  inputs: { type: string; required?: string[]; properties: Record<string, { type: string; description?: string }> }
  outputs: { type: string; required?: string[]; properties: Record<string, { type: string; description?: string }> }
  eval_suite?: { id: string; score: number }[]
  tags?: string[]
}

export interface EvalDelta {
  baseline_version: string
  target_version: string
  overall_baseline: number | null
  overall_target: number | null
  overall_delta: number | null
  entries: { id: string; baseline_score: number | null; target_score: number | null; delta: number | null; status: string }[]
}

export interface TeamMetric {
  team: string
  agents_authored: number
  agents_reused: number
  reuse_ratio: number
}

export async function fetchCatalog(): Promise<CatalogEntry[]> {
  const res = await fetch(`${BASE}/agents`)
  return res.json()
}

export async function fetchManifest(name: string, version: string): Promise<AgentManifest> {
  const res = await fetch(`${BASE}/agents/${name}/versions/${version}`)
  return res.json()
}

export async function fetchVersions(name: string): Promise<string[]> {
  const res = await fetch(`${BASE}/agents/${name}/versions`)
  const data = await res.json()
  return data.versions
}

export async function fetchEvalDelta(name: string, version: string, baseline: string): Promise<EvalDelta> {
  const res = await fetch(`${BASE}/agents/${name}/${version}/eval-delta?baseline=${baseline}`)
  if (!res.ok) throw new Error(`eval-delta failed: ${res.status}`)
  return res.json()
}

export async function fetchTeamMetrics(): Promise<TeamMetric[]> {
  const res = await fetch(`${BASE}/metrics/teams`)
  return res.json()
}
