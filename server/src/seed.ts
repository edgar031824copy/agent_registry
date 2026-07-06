import fs from 'fs'
import path from 'path'
import { parseManifest } from './manifest'
import { saveManifest, listAgents } from './storage'
import { recordPush, recordPull } from './db'

// Demo manifests seeded on boot when the registry is empty (SEED_ON_BOOT=true).
// Keeps the deployed registry populated on ephemeral disks (Render restarts).
// 1.2.0-breaking is intentionally absent — it must fail live, never be pre-loaded.
const SEED_FILES = [
  'summarizer-agent-1.0.0.yaml',
  'summarizer-agent-1.1.0.yaml',
  'summarizer-agent-2.0.0.yaml',
  'classifier-agent-1.0.0.yaml'
]

export function seedIfEmpty(): void {
  if (listAgents().length > 0) return

  const manifestsDir = path.resolve(__dirname, '../../manifests')
  for (const file of SEED_FILES) {
    const yamlContent = fs.readFileSync(path.join(manifestsDir, file), 'utf-8')
    const manifest = parseManifest(yamlContent)
    saveManifest(manifest, yamlContent)
    recordPush(manifest.name, manifest.version, manifest.author_team)
  }
  // One cross-team pull so the reuse metric view has data
  recordPull('summarizer-agent', '1.1.0', 'platform-team')

  console.log(`Seeded registry with ${SEED_FILES.length} demo manifests`)
}
