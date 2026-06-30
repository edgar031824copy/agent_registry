import fs from 'fs'
import path from 'path'
import { AgentManifest, parseManifest } from './manifest'

const DATA_DIR = path.join(__dirname, '../data/manifests')

export function saveManifest(manifest: AgentManifest, yamlContent: string): void {
  const dir = path.join(DATA_DIR, manifest.name)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, `${manifest.version}.yaml`), yamlContent, 'utf-8')
}

export function loadManifest(name: string, version: string): AgentManifest | null {
  const filePath = path.join(DATA_DIR, name, `${version}.yaml`)
  if (!fs.existsSync(filePath)) return null
  const content = fs.readFileSync(filePath, 'utf-8')
  return parseManifest(content)
}

export function listVersions(name: string): string[] {
  const dir = path.join(DATA_DIR, name)
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.yaml'))
    .map(f => f.replace('.yaml', ''))
    .sort()
}

export function listAgents(): string[] {
  if (!fs.existsSync(DATA_DIR)) return []
  return fs.readdirSync(DATA_DIR).filter(f =>
    fs.statSync(path.join(DATA_DIR, f)).isDirectory()
  )
}
