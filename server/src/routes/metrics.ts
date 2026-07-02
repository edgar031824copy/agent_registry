import { Router, Request, Response } from 'express'
import { getTeamMetrics } from '../db'

const router = Router()

// GET /metrics/teams
router.get('/teams', (_req: Request, res: Response) => {
  return res.json(getTeamMetrics())
})

export default router
