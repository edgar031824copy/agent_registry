import { Router, Request, Response } from 'express'
import { loadManifest, listVersions } from '../storage'
import { recordPull } from '../db'

const router = Router({ mergeParams: true })

// GET /agents/:name/versions
router.get('/', (req: Request, res: Response) => {
  const { name } = req.params as { name: string }
  const versions = listVersions(name)
  if (versions.length === 0) return res.status(404).json({ error: `Agent "${name}" not found` })
  return res.json({ name, versions })
})

// GET /agents/:name/:version — pull manifest
router.get('/:version', (req: Request, res: Response) => {
  const { name, version } = req.params as { name: string; version: string }
  const pulling_team = req.query.team as string | undefined

  const manifest = loadManifest(name, version)
  if (!manifest) return res.status(404).json({ error: `${name}@${version} not found` })

  if (pulling_team) recordPull(name, version, pulling_team)

  return res.json(manifest)
})

export default router
