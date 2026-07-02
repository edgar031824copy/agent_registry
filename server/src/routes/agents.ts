import { Router, Request, Response } from 'express'
import semver from 'semver'
import { parseManifest } from '../manifest'
import { saveManifest, loadManifest, listVersions, listAgents } from '../storage'
import { detectBreakingChanges } from '../schema-diff'
import { recordPush } from '../db'

const router = Router()

// POST /agents — push a new agent version
router.post('/', (req: Request, res: Response) => {
  const { yaml: yamlContent, pushing_team } = req.body as { yaml: string; pushing_team: string }

  if (!yamlContent || !pushing_team) {
    return res.status(400).json({ error: 'yaml and pushing_team are required' })
  }

  let manifest
  try {
    manifest = parseManifest(yamlContent)
  } catch (e) {
    return res.status(400).json({ error: (e as Error).message })
  }

  // Check for existing versions to detect breaking changes
  const versions = listVersions(manifest.name)
  if (versions.length > 0) {
    const latestVersion = versions.sort(semver.compare).at(-1)!
    const latestMajor = semver.major(latestVersion)
    const newMajor = semver.major(manifest.version)

    // Only check breaking changes within the same major version
    if (newMajor === latestMajor) {
      const latestManifest = loadManifest(manifest.name, latestVersion)!
      const breakingChanges = detectBreakingChanges(latestManifest, manifest)
      if (breakingChanges.length > 0) {
        return res.status(422).json({
          error: 'Breaking schema change detected — bump the major version to publish',
          breaking_changes: breakingChanges
        })
      }
    }
  }

  // Check version doesn't already exist
  if (loadManifest(manifest.name, manifest.version)) {
    return res.status(409).json({ error: `${manifest.name}@${manifest.version} already exists` })
  }

  saveManifest(manifest, yamlContent)
  recordPush(manifest.name, manifest.version, manifest.author_team)

  return res.status(201).json({
    message: `${manifest.name}@${manifest.version} published successfully`,
    manifest
  })
})

// GET /agents — catalog list
router.get('/', (_req: Request, res: Response) => {
  const agents = listAgents()
  const catalog = agents.map(name => {
    const versions = listVersions(name).sort(semver.compare)
    const latest = versions.at(-1)!
    const manifest = loadManifest(name, latest)!
    return {
      name,
      latest_version: latest,
      versions,
      description: manifest.description,
      author_team: manifest.author_team,
      tags: manifest.tags ?? []
    }
  })
  return res.json(catalog)
})

export default router
