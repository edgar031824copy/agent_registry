import { Router, Request, Response } from 'express'
import semver from 'semver'
import yaml from 'js-yaml'
import { parseManifest } from '../manifest'
import { saveManifest, loadManifest, listVersions, listAgents } from '../storage'
import { detectBreakingChanges } from '../schema-diff'
import { recordPush } from '../db'
import { runEvalSuite, applyComputedScores, EvalRunResult } from '../eval-runner'

const router = Router()

// POST /agents — push a new agent version
router.post('/', async (req: Request, res: Response) => {
  const { yaml: yamlContent, pushing_team, run_evals } = req.body as {
    yaml: string; pushing_team: string; run_evals?: boolean
  }

  if (!yamlContent || !pushing_team) {
    return res.status(400).json({ error: 'yaml and pushing_team are required' })
  }

  let manifest
  try {
    manifest = parseManifest(yamlContent)
  } catch (e) {
    return res.status(400).json({ error: (e as Error).message })
  }

  // Check for existing versions to detect breaking changes.
  // Baseline = latest version within the SAME major line — a new 1.x must be
  // compatible with the existing 1.x consumers even if 2.x already exists.
  const versions = listVersions(manifest.name)
  if (versions.length > 0) {
    const newMajor = semver.major(manifest.version)
    const sameMajorBaseline = versions
      .filter(v => semver.major(v) === newMajor)
      .sort(semver.compare)
      .at(-1)

    if (sameMajorBaseline) {
      const latestManifest = loadManifest(manifest.name, sameMajorBaseline)!
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

  // Optionally execute the eval suite live and store computed scores
  // instead of the publisher-declared ones (opt-in: --eval flag or EVAL_ON_PUSH=true)
  const shouldRunEvals = run_evals === true || process.env.EVAL_ON_PUSH === 'true'
  let evalResults: EvalRunResult[] | undefined
  let finalManifest = manifest
  let finalYaml = yamlContent

  if (shouldRunEvals && (manifest.eval_suite?.length ?? 0) > 0) {
    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(400).json({
        error: 'Eval execution requested but ANTHROPIC_API_KEY is not set on the server'
      })
    }
    try {
      evalResults = await runEvalSuite(manifest)
    } catch (e) {
      return res.status(502).json({ error: `Eval execution failed: ${(e as Error).message}` })
    }
    finalManifest = applyComputedScores(manifest, evalResults)
    finalYaml = yaml.dump(finalManifest)
  }

  saveManifest(finalManifest, finalYaml)
  recordPush(finalManifest.name, finalManifest.version, finalManifest.author_team)

  return res.status(201).json({
    message: `${finalManifest.name}@${finalManifest.version} published successfully`,
    manifest: finalManifest,
    ...(evalResults ? { eval_results: evalResults } : {})
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
