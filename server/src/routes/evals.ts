import { Router, Request, Response } from 'express'
import { loadManifest } from '../storage'
import { computeEvalDelta } from '../eval'

const router = Router({ mergeParams: true })

// GET /agents/:name/:version/eval-delta?baseline=X.Y.Z
router.get('/', (req: Request, res: Response) => {
  const { name, version } = req.params as { name: string; version: string }
  const baseline = req.query.baseline as string | undefined

  if (!baseline) return res.status(400).json({ error: 'baseline query param required' })

  const baselineManifest = loadManifest(name, baseline)
  const targetManifest = loadManifest(name, version)

  if (!baselineManifest) return res.status(404).json({ error: `${name}@${baseline} not found` })
  if (!targetManifest) return res.status(404).json({ error: `${name}@${version} not found` })

  if (!baselineManifest.eval_suite?.length || !targetManifest.eval_suite?.length) {
    return res.status(400).json({ error: 'Both versions must have eval_suite entries' })
  }

  return res.json(computeEvalDelta(baselineManifest, targetManifest))
})

export default router
