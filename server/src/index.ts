import path from 'path'
import dotenv from 'dotenv'
// Load .env from repo root (ANTHROPIC_API_KEY for eval-on-push, EVAL_ON_PUSH)
dotenv.config({ path: path.resolve(__dirname, '../../.env') })
import express from 'express'
import cors from 'cors'
import agentsRouter from './routes/agents'
import versionsRouter from './routes/versions'
import evalsRouter from './routes/evals'
import metricsRouter from './routes/metrics'

const app = express()
app.use(cors())
app.use(express.json({ limit: '1mb' }))

app.use('/agents', agentsRouter)
app.use('/agents/:name/versions', versionsRouter)
app.use('/agents/:name/:version/eval-delta', evalsRouter)
app.use('/metrics', metricsRouter)

app.get('/health', (_req, res) => res.json({ status: 'ok' }))

app.listen(3001, () => {
  console.log('Agent Registry server running on http://localhost:3001')
})
