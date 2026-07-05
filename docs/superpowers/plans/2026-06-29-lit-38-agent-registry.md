# LIT-38 Agent Registry + Versioning — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a working Agent Registry — a discoverable catalog with versioning, schema-on-push validation, parallel version coexistence, eval delta reports, and team reuse metrics — demoed via CLI + web dashboard.

**Architecture:** A monorepo with three parts: an Express server that stores agent manifests (YAML) and enforces schema rules on push; a TypeScript CLI (`agent push/pull/list/eval`) that talks to the server; and a React dashboard that visualizes the catalog, schema diffs, eval deltas, and team metrics. Storage is filesystem-based manifests + SQLite locally; Supabase Storage + PostgreSQL in production.

**Tech Stack:** TypeScript, Node.js 20+, Express 4, Commander (CLI), AJV (JSON Schema validation), js-yaml, better-sqlite3, React 18, Vite, Tailwind CSS.

## Global Constraints

- TypeScript strict mode everywhere (`"strict": true`)
- Node.js 20+ required
- All manifest files are YAML; all API payloads are JSON
- Semver (`Major.Minor.Patch`) for all agent versions — e.g. `summarizer-agent@1.2.0`
- Breaking change = removes a required input field, changes a field type, or removes a required output field
- Non-breaking = adds optional fields, adds new required output fields, adds new optional inputs
- `author_team` is a required field in every manifest
- Every `agent push` is logged to SQLite locally / Supabase PostgreSQL in production
- Every `agent pull` is logged to SQLite locally / Supabase PostgreSQL in production
- CLI base URL defaults to `http://localhost:3001`; overridable via `AGENT_REGISTRY_URL` env var
- Dashboard runs on port 3000; server runs on port 3001
- Production: server on Render, dashboard on Vercel, data on Supabase

---

## Manifest Format (reference for all tasks)

Every agent manifest is a YAML file with this exact shape:

```yaml
name: summarizer-agent          # kebab-case, required
version: 1.2.0                  # semver, required
description: "Summarizes docs"  # required
author_team: aisdlc             # required — used for reuse metrics
model_recommendations:          # optional list
  - claude-sonnet-4-6
inputs:                         # JSON Schema object, required
  type: object
  required: [text]
  properties:
    text:
      type: string
      description: "Text to summarize"
    max_length:
      type: integer
      default: 500
outputs:                        # JSON Schema object, required
  type: object
  required: [summary]
  properties:
    summary:
      type: string
eval_suite:                     # optional — array of benchmark results
  - id: basic-summarization
    input: { text: "The quick brown fox..." }
    expected_output_contains: [summary]
    score: 0.95
  - id: long-document
    input: { text: "Long document text..." }
    expected_output_contains: [summary]
    score: 0.88
tags: [nlp, summarization]      # optional
```

## Breaking Change Rules (reference for Task 5)

A push from `X.Y.Z` to `X.Y.Z+1` or `X.Y+1.0` (same major) is **rejected** if:
- A field listed in `inputs.required` in the old version is removed or renamed in the new version
- A property type in `inputs.properties` changes (e.g. `string` → `integer`)
- A field listed in `outputs.required` in the old version is removed or renamed in the new version
- A new field is added to `inputs.required` without a `default` value

A push to a **new major version** (`X+1.0.0`) always passes schema check regardless of changes.

---

## File Structure

```
agent-registry/
  server/
    src/
      index.ts              # Express entry point, mounts all routes
      db.ts                 # SQLite init + all queries (pushes, pulls, metrics)
      storage.ts            # Filesystem manifest read/write
      manifest.ts           # YAML parse, validate manifest shape, extract schema fields
      schema-diff.ts        # Breaking change detection logic
      eval.ts               # Eval delta computation between two versions
      routes/
        agents.ts           # POST /agents (push), GET /agents (list)
        versions.ts         # GET /agents/:name/versions, GET /agents/:name/:version (pull)
        evals.ts            # GET /agents/:name/:version/eval-delta?baseline=X.Y.Z
        metrics.ts          # GET /metrics/teams
    data/
      manifests/            # YAML files stored as <name>/<version>.yaml
      registry.db           # SQLite database
    package.json
    tsconfig.json
  cli/
    src/
      index.ts              # Commander root, registers all commands
      commands/
        push.ts             # agent push <file>
        pull.ts             # agent pull <name>@<version>
        list.ts             # agent list [name]
        eval.ts             # agent eval <name>@<version> --baseline <version>
      http.ts               # shared axios wrapper for server calls
    package.json
    tsconfig.json
  client/
    src/
      App.tsx               # Router: / catalog, /agents/:name detail, /metrics
      api.ts                # fetch wrappers for all server endpoints
      components/
        CatalogView.tsx     # Grid of all agents + latest version
        AgentDetail.tsx     # Version list, schema viewer, push history
        SchemaDiff.tsx      # Visual diff of inputs/outputs between two versions
        EvalDelta.tsx       # Score comparison table between two versions
        TeamMetrics.tsx     # Bar chart: reuse ratio per team
    index.html
    vite.config.ts
    package.json
    tailwind.config.js
  manifests/                # Demo manifests checked into repo
    summarizer-agent-1.0.0.yaml
    summarizer-agent-1.1.0.yaml
    summarizer-agent-1.2.0-breaking.yaml   # intentional breaking change (for demo)
    summarizer-agent-2.0.0.yaml            # major bump, accepted
    classifier-agent-1.0.0.yaml            # second agent (for catalog demo)
  package.json              # root: workspaces + dev scripts
  README.md
```

---

## Task 1: Monorepo Scaffold

**Files:**
- Create: `package.json` (root)
- Create: `server/package.json`
- Create: `server/tsconfig.json`
- Create: `cli/package.json`
- Create: `cli/tsconfig.json`
- Create: `client/package.json`
- Create: `client/vite.config.ts`
- Create: `client/tailwind.config.js`
- Create: `client/index.html`

**Interfaces:**
- Produces: `npm run dev` starts server + client; `npm run cli` runs the CLI

- [ ] **Step 1: Create root package.json**

```json
{
  "name": "agent-registry",
  "private": true,
  "workspaces": ["server", "cli", "client"],
  "scripts": {
    "dev": "concurrently \"npm run dev --workspace=server\" \"npm run dev --workspace=client\"",
    "build": "npm run build --workspace=server && npm run build --workspace=client",
    "cli": "npm run start --workspace=cli"
  },
  "devDependencies": {
    "concurrently": "^8.2.2"
  }
}
```

- [ ] **Step 2: Create server/package.json**

```json
{
  "name": "agent-registry-server",
  "version": "1.0.0",
  "scripts": {
    "dev": "ts-node-dev --respawn src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "better-sqlite3": "^9.4.3",
    "js-yaml": "^4.1.0",
    "ajv": "^8.12.0",
    "semver": "^7.6.0",
    "cors": "^2.8.5"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/better-sqlite3": "^7.6.8",
    "@types/js-yaml": "^4.0.9",
    "@types/semver": "^7.5.6",
    "@types/cors": "^2.8.17",
    "@types/node": "^20.11.0",
    "typescript": "^5.3.3",
    "ts-node-dev": "^2.0.0"
  }
}
```

- [ ] **Step 3: Create server/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 4: Create cli/package.json**

```json
{
  "name": "agent-registry-cli",
  "version": "1.0.0",
  "bin": { "agent": "./dist/index.js" },
  "scripts": {
    "build": "tsc",
    "start": "ts-node src/index.ts",
    "dev": "ts-node-dev src/index.ts"
  },
  "dependencies": {
    "commander": "^12.0.0",
    "axios": "^1.6.7",
    "js-yaml": "^4.1.0",
    "chalk": "^4.1.2"
  },
  "devDependencies": {
    "@types/js-yaml": "^4.0.9",
    "@types/node": "^20.11.0",
    "typescript": "^5.3.3",
    "ts-node-dev": "^2.0.0",
    "ts-node": "^10.9.2"
  }
}
```

- [ ] **Step 5: Create cli/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 6: Create client/package.json**

```json
{
  "name": "agent-registry-client",
  "version": "1.0.0",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.22.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.55",
    "@types/react-dom": "^18.2.19",
    "@vitejs/plugin-react": "^4.2.1",
    "autoprefixer": "^10.4.17",
    "postcss": "^8.4.35",
    "tailwindcss": "^3.4.1",
    "typescript": "^5.3.3",
    "vite": "^5.1.0"
  }
}
```

- [ ] **Step 7: Create client/vite.config.ts**

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
  }
})
```

- [ ] **Step 8: Create client/tailwind.config.js**

```js
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: { extend: {} },
  plugins: []
}
```

- [ ] **Step 9: Create client/index.html**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Agent Registry</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 10: Install all dependencies**

```bash
npm install
```

Expected: `node_modules` created in root, server, cli, and client workspaces.

- [ ] **Step 11: Create placeholder entry points so TypeScript compiles**

`server/src/index.ts`:
```typescript
import express from 'express'
const app = express()
app.listen(3001, () => console.log('Registry server on :3001'))
```

`cli/src/index.ts`:
```typescript
import { Command } from 'commander'
const program = new Command()
program.name('agent').version('1.0.0')
program.parse()
```

`client/src/main.tsx`:
```typescript
import React from 'react'
import ReactDOM from 'react-dom/client'
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><div>Agent Registry</div></React.StrictMode>)
```

- [ ] **Step 12: Verify build compiles**

```bash
npm run build --workspace=server
npm run build --workspace=cli
```

Expected: `server/dist/index.js` and `cli/dist/index.js` created with no errors.

- [ ] **Step 13: Commit**

```bash
git init
git add .
git commit -m "feat: monorepo scaffold — server, cli, client"
```

---

## Task 2: Manifest Parsing + Validation (`server/src/manifest.ts`)

**Files:**
- Create: `server/src/manifest.ts`

**Interfaces:**
- Produces:
  - `parseManifest(yamlContent: string): AgentManifest` — parses YAML, throws if invalid
  - `AgentManifest` type used by all other server modules
  - `validateManifestShape(manifest: unknown): AgentManifest` — AJV validation

- [ ] **Step 1: Create `server/src/manifest.ts` with types and validator**

```typescript
import yaml from 'js-yaml'
import Ajv from 'ajv'

export interface EvalEntry {
  id: string
  input: Record<string, unknown>
  expected_output_contains: string[]
  score: number
}

export interface AgentManifest {
  name: string
  version: string
  description: string
  author_team: string
  model_recommendations?: string[]
  inputs: {
    type: 'object'
    required?: string[]
    properties: Record<string, { type: string; description?: string; default?: unknown }>
  }
  outputs: {
    type: 'object'
    required?: string[]
    properties: Record<string, { type: string; description?: string }>
  }
  eval_suite?: EvalEntry[]
  tags?: string[]
}

const ajv = new Ajv()

const MANIFEST_SCHEMA = {
  type: 'object',
  required: ['name', 'version', 'description', 'author_team', 'inputs', 'outputs'],
  properties: {
    name: { type: 'string', pattern: '^[a-z][a-z0-9-]*$' },
    version: { type: 'string', pattern: '^\\d+\\.\\d+\\.\\d+$' },
    description: { type: 'string', minLength: 1 },
    author_team: { type: 'string', minLength: 1 },
    model_recommendations: { type: 'array', items: { type: 'string' } },
    inputs: {
      type: 'object',
      required: ['type', 'properties'],
      properties: {
        type: { type: 'string', enum: ['object'] },
        required: { type: 'array', items: { type: 'string' } },
        properties: { type: 'object' }
      }
    },
    outputs: {
      type: 'object',
      required: ['type', 'properties'],
      properties: {
        type: { type: 'string', enum: ['object'] },
        required: { type: 'array', items: { type: 'string' } },
        properties: { type: 'object' }
      }
    },
    eval_suite: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'input', 'expected_output_contains', 'score'],
        properties: {
          id: { type: 'string' },
          input: { type: 'object' },
          expected_output_contains: { type: 'array', items: { type: 'string' } },
          score: { type: 'number', minimum: 0, maximum: 1 }
        }
      }
    },
    tags: { type: 'array', items: { type: 'string' } }
  },
  additionalProperties: false
}

const validate = ajv.compile(MANIFEST_SCHEMA)

export function validateManifestShape(data: unknown): AgentManifest {
  const valid = validate(data)
  if (!valid) {
    const errors = validate.errors?.map(e => `${e.instancePath} ${e.message}`).join('; ')
    throw new Error(`Invalid manifest: ${errors}`)
  }
  return data as AgentManifest
}

export function parseManifest(yamlContent: string): AgentManifest {
  let parsed: unknown
  try {
    parsed = yaml.load(yamlContent)
  } catch (e) {
    throw new Error(`YAML parse error: ${(e as Error).message}`)
  }
  return validateManifestShape(parsed)
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run build --workspace=server
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add server/src/manifest.ts
git commit -m "feat: manifest YAML parser and AJV shape validator"
```

---

## Task 3: Storage Layer (`server/src/storage.ts` + `server/src/db.ts`)

**Files:**
- Create: `server/src/storage.ts`
- Create: `server/src/db.ts`
- Create: `server/data/manifests/` (directory, gitkeep)

**Interfaces:**
- Consumes: `AgentManifest` from `manifest.ts`
- Produces:
  - `saveManifest(manifest: AgentManifest, yamlContent: string): void`
  - `loadManifest(name: string, version: string): AgentManifest | null`
  - `listVersions(name: string): string[]`
  - `listAgents(): string[]`
  - `recordPush(name: string, version: string, team: string): void`
  - `recordPull(name: string, version: string, pullingTeam: string): void`
  - `getTeamMetrics(): TeamMetric[]`
  - `TeamMetric` type

- [ ] **Step 1: Create data directory and gitkeep**

```bash
mkdir -p server/data/manifests
touch server/data/manifests/.gitkeep
```

- [ ] **Step 2: Create `server/src/storage.ts`**

```typescript
import fs from 'fs'
import path from 'path'
import yaml from 'js-yaml'
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
```

- [ ] **Step 3: Create `server/src/db.ts`**

```typescript
import Database from 'better-sqlite3'
import path from 'path'

const DB_PATH = path.join(__dirname, '../data/registry.db')

const db = new Database(DB_PATH)

db.exec(`
  CREATE TABLE IF NOT EXISTS pushes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_name TEXT NOT NULL,
    version TEXT NOT NULL,
    author_team TEXT NOT NULL,
    pushed_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS pulls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_name TEXT NOT NULL,
    version TEXT NOT NULL,
    pulling_team TEXT NOT NULL,
    pulled_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`)

export interface TeamMetric {
  team: string
  agents_authored: number
  agents_reused: number
  reuse_ratio: number
}

export function recordPush(name: string, version: string, team: string): void {
  db.prepare(
    'INSERT INTO pushes (agent_name, version, author_team) VALUES (?, ?, ?)'
  ).run(name, version, team)
}

export function recordPull(name: string, version: string, pullingTeam: string): void {
  db.prepare(
    'INSERT INTO pulls (agent_name, version, pulling_team) VALUES (?, ?, ?)'
  ).run(name, version, pullingTeam)
}

export function getTeamMetrics(): TeamMetric[] {
  // authored = distinct agents pushed by this team
  const authored = db.prepare(`
    SELECT author_team as team, COUNT(DISTINCT agent_name) as agents_authored
    FROM pushes GROUP BY author_team
  `).all() as { team: string; agents_authored: number }[]

  // reused = distinct agents pulled by this team that were NOT authored by them
  const reused = db.prepare(`
    SELECT p.pulling_team as team, COUNT(DISTINCT p.agent_name) as agents_reused
    FROM pulls p
    WHERE NOT EXISTS (
      SELECT 1 FROM pushes ps
      WHERE ps.agent_name = p.agent_name AND ps.author_team = p.pulling_team
    )
    GROUP BY p.pulling_team
  `).all() as { team: string; agents_reused: number }[]

  const reusedMap = new Map(reused.map(r => [r.team, r.agents_reused]))

  return authored.map(a => ({
    team: a.team,
    agents_authored: a.agents_authored,
    agents_reused: reusedMap.get(a.team) ?? 0,
    reuse_ratio: parseFloat(
      ((reusedMap.get(a.team) ?? 0) / (a.agents_authored + (reusedMap.get(a.team) ?? 0))).toFixed(2)
    )
  }))
}
```

- [ ] **Step 4: Verify build**

```bash
npm run build --workspace=server
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add server/src/storage.ts server/src/db.ts server/data/manifests/.gitkeep
git commit -m "feat: filesystem storage + SQLite push/pull tracking"
```

---

## Task 4: Breaking Change Detection (`server/src/schema-diff.ts`)

**Files:**
- Create: `server/src/schema-diff.ts`

**Interfaces:**
- Consumes: `AgentManifest` from `manifest.ts`
- Produces:
  - `detectBreakingChanges(oldManifest: AgentManifest, newManifest: AgentManifest): BreakingChange[]`
  - `BreakingChange` type: `{ field: string; reason: string }`

- [ ] **Step 1: Create `server/src/schema-diff.ts`**

```typescript
import { AgentManifest } from './manifest'

export interface BreakingChange {
  field: string
  reason: string
}

export function detectBreakingChanges(
  oldManifest: AgentManifest,
  newManifest: AgentManifest
): BreakingChange[] {
  const changes: BreakingChange[] = []

  const oldInputRequired = oldManifest.inputs.required ?? []
  const newInputProps = newManifest.inputs.properties
  const oldInputProps = oldManifest.inputs.properties

  // Rule 1: required input field removed or renamed
  for (const field of oldInputRequired) {
    if (!newInputProps[field]) {
      changes.push({
        field: `inputs.${field}`,
        reason: `Required input field "${field}" was removed`
      })
    }
  }

  // Rule 2: input field type changed
  for (const [field, oldDef] of Object.entries(oldInputProps)) {
    const newDef = newInputProps[field]
    if (newDef && oldDef.type !== newDef.type) {
      changes.push({
        field: `inputs.${field}`,
        reason: `Input field "${field}" type changed from "${oldDef.type}" to "${newDef.type}"`
      })
    }
  }

  // Rule 3: new required input field added without default
  const newInputRequired = newManifest.inputs.required ?? []
  for (const field of newInputRequired) {
    if (!oldInputProps[field] && !newInputProps[field]?.default) {
      changes.push({
        field: `inputs.${field}`,
        reason: `New required input field "${field}" added without a default value`
      })
    }
  }

  // Rule 4: required output field removed
  const oldOutputRequired = oldManifest.outputs.required ?? []
  const newOutputProps = newManifest.outputs.properties

  for (const field of oldOutputRequired) {
    if (!newOutputProps[field]) {
      changes.push({
        field: `outputs.${field}`,
        reason: `Required output field "${field}" was removed`
      })
    }
  }

  // Rule 5: output field type changed
  const oldOutputProps = oldManifest.outputs.properties
  for (const [field, oldDef] of Object.entries(oldOutputProps)) {
    const newDef = newOutputProps[field]
    if (newDef && oldDef.type !== newDef.type) {
      changes.push({
        field: `outputs.${field}`,
        reason: `Output field "${field}" type changed from "${oldDef.type}" to "${newDef.type}"`
      })
    }
  }

  return changes
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build --workspace=server
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add server/src/schema-diff.ts
git commit -m "feat: breaking change detection for agent schema push"
```

---

## Task 5: Eval Delta (`server/src/eval.ts`)

**Files:**
- Create: `server/src/eval.ts`

**Interfaces:**
- Consumes: `AgentManifest` from `manifest.ts`
- Produces:
  - `computeEvalDelta(baseline: AgentManifest, target: AgentManifest): EvalDelta`
  - `EvalDelta` type

- [ ] **Step 1: Create `server/src/eval.ts`**

```typescript
import { AgentManifest, EvalEntry } from './manifest'

export interface EvalEntryDelta {
  id: string
  baseline_score: number | null
  target_score: number | null
  delta: number | null
  status: 'improved' | 'regressed' | 'unchanged' | 'new' | 'removed'
}

export interface EvalDelta {
  baseline_version: string
  target_version: string
  overall_baseline: number | null
  overall_target: number | null
  overall_delta: number | null
  entries: EvalEntryDelta[]
}

function average(scores: number[]): number | null {
  if (scores.length === 0) return null
  return parseFloat((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(4))
}

export function computeEvalDelta(baseline: AgentManifest, target: AgentManifest): EvalDelta {
  const baselineEntries = new Map<string, EvalEntry>(
    (baseline.eval_suite ?? []).map(e => [e.id, e])
  )
  const targetEntries = new Map<string, EvalEntry>(
    (target.eval_suite ?? []).map(e => [e.id, e])
  )

  const allIds = new Set([...baselineEntries.keys(), ...targetEntries.keys()])
  const entries: EvalEntryDelta[] = []

  for (const id of allIds) {
    const b = baselineEntries.get(id)
    const t = targetEntries.get(id)

    if (b && t) {
      const delta = parseFloat((t.score - b.score).toFixed(4))
      entries.push({
        id,
        baseline_score: b.score,
        target_score: t.score,
        delta,
        status: delta > 0.01 ? 'improved' : delta < -0.01 ? 'regressed' : 'unchanged'
      })
    } else if (!b && t) {
      entries.push({ id, baseline_score: null, target_score: t.score, delta: null, status: 'new' })
    } else if (b && !t) {
      entries.push({ id, baseline_score: b.score, target_score: null, delta: null, status: 'removed' })
    }
  }

  const baselineScores = entries.filter(e => e.baseline_score !== null).map(e => e.baseline_score!)
  const targetScores = entries.filter(e => e.target_score !== null).map(e => e.target_score!)
  const ob = average(baselineScores)
  const ot = average(targetScores)

  return {
    baseline_version: baseline.version,
    target_version: target.version,
    overall_baseline: ob,
    overall_target: ot,
    overall_delta: ob !== null && ot !== null ? parseFloat((ot - ob).toFixed(4)) : null,
    entries
  }
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build --workspace=server
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add server/src/eval.ts
git commit -m "feat: eval delta computation between agent versions"
```

---

## Task 6: Server Routes + Entry Point

**Files:**
- Create: `server/src/routes/agents.ts`
- Create: `server/src/routes/versions.ts`
- Create: `server/src/routes/evals.ts`
- Create: `server/src/routes/metrics.ts`
- Modify: `server/src/index.ts`

**Interfaces:**
- Consumes: all modules from Tasks 2–5
- Produces: running HTTP server on :3001 with these endpoints:
  - `POST /agents` — push agent (body: `{ yaml: string, pushing_team: string }`)
  - `GET /agents` — list all agents with latest version
  - `GET /agents/:name/versions` — list versions for an agent
  - `GET /agents/:name/:version` — get manifest JSON
  - `GET /agents/:name/:version/eval-delta?baseline=X.Y.Z` — eval delta
  - `GET /metrics/teams` — team reuse metrics

- [ ] **Step 1: Create `server/src/routes/agents.ts`**

```typescript
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
```

- [ ] **Step 2: Create `server/src/routes/versions.ts`**

```typescript
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
```

- [ ] **Step 3: Create `server/src/routes/evals.ts`**

```typescript
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
```

- [ ] **Step 4: Create `server/src/routes/metrics.ts`**

```typescript
import { Router, Request, Response } from 'express'
import { getTeamMetrics } from '../db'

const router = Router()

// GET /metrics/teams
router.get('/teams', (_req: Request, res: Response) => {
  return res.json(getTeamMetrics())
})

export default router
```

- [ ] **Step 5: Rewrite `server/src/index.ts`**

```typescript
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
```

- [ ] **Step 6: Verify build**

```bash
npm run build --workspace=server
```

Expected: no errors.

- [ ] **Step 7: Start server and smoke test**

```bash
npm run dev --workspace=server
```

In another terminal:
```bash
curl http://localhost:3001/health
```
Expected: `{"status":"ok"}`

- [ ] **Step 8: Commit**

```bash
git add server/src/routes/ server/src/index.ts
git commit -m "feat: server routes — push, pull, list, eval-delta, metrics"
```

---

## Task 7: Demo Agent Manifests

**Files:**
- Create: `manifests/summarizer-agent-1.0.0.yaml`
- Create: `manifests/summarizer-agent-1.1.0.yaml`
- Create: `manifests/summarizer-agent-1.2.0-breaking.yaml`
- Create: `manifests/summarizer-agent-2.0.0.yaml`
- Create: `manifests/classifier-agent-1.0.0.yaml`

**Interfaces:**
- Produces: demo manifests used to exercise all 5 ACs during the demo

- [ ] **Step 1: Create `manifests/summarizer-agent-1.0.0.yaml`**

```yaml
name: summarizer-agent
version: 1.0.0
description: "Summarizes documents into concise bullet points using Claude"
author_team: aisdlc
model_recommendations:
  - claude-sonnet-4-6
inputs:
  type: object
  required: [text]
  properties:
    text:
      type: string
      description: "Full text to summarize"
    max_length:
      type: integer
      description: "Max summary length in words"
      default: 500
outputs:
  type: object
  required: [summary]
  properties:
    summary:
      type: string
      description: "Summarized text"
eval_suite:
  - id: short-text
    input: { text: "The quick brown fox jumps over the lazy dog." }
    expected_output_contains: [summary]
    score: 0.91
  - id: technical-doc
    input: { text: "This RFC proposes a new protocol for agent communication..." }
    expected_output_contains: [summary]
    score: 0.87
tags: [nlp, summarization, text-processing]
```

- [ ] **Step 2: Create `manifests/summarizer-agent-1.1.0.yaml`**

```yaml
name: summarizer-agent
version: 1.1.0
description: "Summarizes documents into concise bullet points using Claude — adds language detection"
author_team: aisdlc
model_recommendations:
  - claude-sonnet-4-6
inputs:
  type: object
  required: [text]
  properties:
    text:
      type: string
      description: "Full text to summarize"
    max_length:
      type: integer
      description: "Max summary length in words"
      default: 500
    language:
      type: string
      description: "Target language for summary (optional)"
      default: "en"
outputs:
  type: object
  required: [summary]
  properties:
    summary:
      type: string
      description: "Summarized text"
    detected_language:
      type: string
      description: "Detected language of input"
eval_suite:
  - id: short-text
    input: { text: "The quick brown fox jumps over the lazy dog." }
    expected_output_contains: [summary]
    score: 0.93
  - id: technical-doc
    input: { text: "This RFC proposes a new protocol for agent communication..." }
    expected_output_contains: [summary]
    score: 0.90
  - id: multilingual
    input: { text: "Este es un texto en español para probar la detección de idioma." }
    expected_output_contains: [summary]
    score: 0.88
tags: [nlp, summarization, text-processing, multilingual]
```

- [ ] **Step 3: Create `manifests/summarizer-agent-1.2.0-breaking.yaml`**

This manifest intentionally removes the `text` required input — used in the demo to show AC#2 rejection.

```yaml
name: summarizer-agent
version: 1.2.0
description: "BREAKING VERSION — removes required text field (demo only)"
author_team: aisdlc
model_recommendations:
  - claude-sonnet-4-6
inputs:
  type: object
  required: [document_url]
  properties:
    document_url:
      type: string
      description: "URL of document to summarize (replaces text field)"
    max_length:
      type: integer
      default: 500
outputs:
  type: object
  required: [summary]
  properties:
    summary:
      type: string
eval_suite:
  - id: url-fetch
    input: { document_url: "https://example.com/doc" }
    expected_output_contains: [summary]
    score: 0.85
tags: [nlp, summarization]
```

- [ ] **Step 4: Create `manifests/summarizer-agent-2.0.0.yaml`**

Same breaking changes as 1.2.0 but with major bump — should be accepted.

```yaml
name: summarizer-agent
version: 2.0.0
description: "v2 — URL-based summarization. Breaking: replaces text input with document_url."
author_team: aisdlc
model_recommendations:
  - claude-sonnet-4-6
  - claude-opus-4-8
inputs:
  type: object
  required: [document_url]
  properties:
    document_url:
      type: string
      description: "URL of document to summarize"
    max_length:
      type: integer
      default: 500
    format:
      type: string
      default: "bullets"
outputs:
  type: object
  required: [summary, source_url]
  properties:
    summary:
      type: string
    source_url:
      type: string
    word_count:
      type: integer
eval_suite:
  - id: short-text
    input: { document_url: "https://example.com/short" }
    expected_output_contains: [summary]
    score: 0.94
  - id: technical-doc
    input: { document_url: "https://example.com/rfc" }
    expected_output_contains: [summary]
    score: 0.92
  - id: multilingual
    input: { document_url: "https://example.com/es-doc" }
    expected_output_contains: [summary]
    score: 0.91
tags: [nlp, summarization, text-processing, multilingual, v2]
```

- [ ] **Step 5: Create `manifests/classifier-agent-1.0.0.yaml`**

```yaml
name: classifier-agent
version: 1.0.0
description: "Classifies text into predefined categories using Claude"
author_team: platform-team
model_recommendations:
  - claude-haiku-4-5-20251001
inputs:
  type: object
  required: [text, categories]
  properties:
    text:
      type: string
      description: "Text to classify"
    categories:
      type: array
      description: "List of possible categories"
    multi_label:
      type: boolean
      default: false
outputs:
  type: object
  required: [category, confidence]
  properties:
    category:
      type: string
    confidence:
      type: number
    all_scores:
      type: object
eval_suite:
  - id: sentiment
    input: { text: "I love this product!", categories: ["positive", "negative", "neutral"] }
    expected_output_contains: [category]
    score: 0.96
  - id: topic
    input: { text: "The president signed a new bill.", categories: ["politics", "sports", "tech"] }
    expected_output_contains: [category]
    score: 0.89
tags: [nlp, classification, text-processing]
```

- [ ] **Step 6: Commit**

```bash
git add manifests/
git commit -m "feat: demo agent manifests for summarizer-agent and classifier-agent"
```

---

## Task 8: CLI Commands

**Files:**
- Create: `cli/src/http.ts`
- Create: `cli/src/commands/push.ts`
- Create: `cli/src/commands/pull.ts`
- Create: `cli/src/commands/list.ts`
- Create: `cli/src/commands/eval.ts`
- Modify: `cli/src/index.ts`

**Interfaces:**
- Consumes: server endpoints from Task 6
- Produces: `agent push`, `agent pull`, `agent list`, `agent eval` CLI commands

- [ ] **Step 1: Create `cli/src/http.ts`**

```typescript
import axios from 'axios'

const BASE_URL = process.env.AGENT_REGISTRY_URL ?? 'http://localhost:3001'

export const http = axios.create({ baseURL: BASE_URL })
```

- [ ] **Step 2: Create `cli/src/commands/push.ts`**

```typescript
import { Command } from 'commander'
import fs from 'fs'
import chalk from 'chalk'
import { http } from '../http'

export function makePushCommand(): Command {
  return new Command('push')
    .argument('<file>', 'Path to agent manifest YAML file')
    .option('-t, --team <team>', 'Pushing team name (defaults to author_team in manifest)')
    .description('Publish an agent manifest to the registry')
    .action(async (file: string, options: { team?: string }) => {
      if (!fs.existsSync(file)) {
        console.error(chalk.red(`File not found: ${file}`))
        process.exit(1)
      }

      const yamlContent = fs.readFileSync(file, 'utf-8')

      try {
        const res = await http.post('/agents', {
          yaml: yamlContent,
          pushing_team: options.team ?? 'unknown'
        })
        console.log(chalk.green(`✓ ${res.data.message}`))
      } catch (err: unknown) {
        if (axios.isAxiosError(err) && err.response) {
          const data = err.response.data as { error: string; breaking_changes?: { field: string; reason: string }[] }
          console.error(chalk.red(`✗ Push rejected: ${data.error}`))
          if (data.breaking_changes?.length) {
            console.error(chalk.yellow('\nBreaking changes detected:'))
            data.breaking_changes.forEach(bc => {
              console.error(chalk.yellow(`  • [${bc.field}] ${bc.reason}`))
            })
          }
          process.exit(1)
        }
        throw err
      }
    })
}

import axios from 'axios'
```

- [ ] **Step 3: Fix the import in push.ts** (axios import must be at top — rewrite the file cleanly)

```typescript
import { Command } from 'commander'
import fs from 'fs'
import chalk from 'chalk'
import axios from 'axios'
import { http } from '../http'

export function makePushCommand(): Command {
  return new Command('push')
    .argument('<file>', 'Path to agent manifest YAML file')
    .option('-t, --team <team>', 'Pushing team name')
    .description('Publish an agent manifest to the registry')
    .action(async (file: string, options: { team?: string }) => {
      if (!fs.existsSync(file)) {
        console.error(chalk.red(`File not found: ${file}`))
        process.exit(1)
      }

      const yamlContent = fs.readFileSync(file, 'utf-8')

      try {
        const res = await http.post('/agents', {
          yaml: yamlContent,
          pushing_team: options.team ?? 'unknown'
        })
        console.log(chalk.green(`✓ ${res.data.message}`))
      } catch (err: unknown) {
        if (axios.isAxiosError(err) && err.response) {
          const data = err.response.data as { error: string; breaking_changes?: { field: string; reason: string }[] }
          console.error(chalk.red(`✗ Push rejected: ${data.error}`))
          if (data.breaking_changes?.length) {
            console.error(chalk.yellow('\nBreaking changes detected:'))
            data.breaking_changes.forEach(bc => {
              console.error(chalk.yellow(`  • [${bc.field}] ${bc.reason}`))
            })
          }
          process.exit(1)
        }
        throw err
      }
    })
}
```

- [ ] **Step 4: Create `cli/src/commands/pull.ts`**

```typescript
import { Command } from 'commander'
import chalk from 'chalk'
import { http } from '../http'

export function makePullCommand(): Command {
  return new Command('pull')
    .argument('<ref>', 'Agent reference in format name@version (e.g. summarizer-agent@1.1.0)')
    .option('-t, --team <team>', 'Your team name (for reuse tracking)')
    .description('Pull an agent manifest from the registry')
    .action(async (ref: string, options: { team?: string }) => {
      const [name, version] = ref.split('@')
      if (!name || !version) {
        console.error(chalk.red('Invalid ref format. Use name@version e.g. summarizer-agent@1.1.0'))
        process.exit(1)
      }

      try {
        const params = options.team ? { team: options.team } : {}
        const res = await http.get(`/agents/${name}/${version}`, { params })
        console.log(chalk.green(`✓ Pulled ${name}@${version}`))
        console.log(JSON.stringify(res.data, null, 2))
      } catch (err: unknown) {
        const { default: axios } = await import('axios')
        if (axios.isAxiosError(err) && err.response?.status === 404) {
          console.error(chalk.red(`✗ ${name}@${version} not found in registry`))
          process.exit(1)
        }
        throw err
      }
    })
}
```

- [ ] **Step 5: Create `cli/src/commands/list.ts`**

```typescript
import { Command } from 'commander'
import chalk from 'chalk'
import { http } from '../http'

interface CatalogEntry {
  name: string
  latest_version: string
  versions: string[]
  description: string
  author_team: string
  tags: string[]
}

export function makeListCommand(): Command {
  return new Command('list')
    .argument('[name]', 'Agent name to list versions for (omit to list all agents)')
    .description('List agents or versions in the registry')
    .action(async (name?: string) => {
      if (name) {
        const res = await http.get(`/agents/${name}/versions`)
        console.log(chalk.bold(`\n${name}`))
        ;(res.data.versions as string[]).forEach(v => console.log(`  ${v}`))
      } else {
        const res = await http.get('/agents')
        const catalog = res.data as CatalogEntry[]
        if (catalog.length === 0) {
          console.log(chalk.yellow('Registry is empty.'))
          return
        }
        console.log(chalk.bold('\nAgent Registry\n'))
        catalog.forEach(agent => {
          console.log(
            chalk.cyan(`  ${agent.name}`) +
            chalk.gray(`@${agent.latest_version}`) +
            `  — ${agent.description}`
          )
          console.log(chalk.gray(`    team: ${agent.author_team}  versions: ${agent.versions.join(', ')}`))
        })
      }
    })
}
```

- [ ] **Step 6: Create `cli/src/commands/eval.ts`**

```typescript
import { Command } from 'commander'
import chalk from 'chalk'
import { http } from '../http'
import type { EvalDelta, EvalEntryDelta } from '../../../server/src/eval'

export function makeEvalCommand(): Command {
  return new Command('eval')
    .argument('<ref>', 'Target version ref (name@version)')
    .requiredOption('-b, --baseline <version>', 'Baseline version to compare against')
    .description('Show eval delta between two agent versions')
    .action(async (ref: string, options: { baseline: string }) => {
      const [name, version] = ref.split('@')
      if (!name || !version) {
        console.error(chalk.red('Invalid ref. Use name@version'))
        process.exit(1)
      }

      const res = await http.get(`/agents/${name}/${version}/eval-delta`, {
        params: { baseline: options.baseline }
      })
      const delta = res.data as EvalDelta

      console.log(chalk.bold(`\nEval Delta: ${name}@${delta.baseline_version} → @${delta.target_version}\n`))

      const overallDir = delta.overall_delta !== null
        ? delta.overall_delta > 0 ? chalk.green(`▲ +${delta.overall_delta}`) : chalk.red(`▼ ${delta.overall_delta}`)
        : chalk.gray('N/A')

      console.log(`Overall score: ${delta.overall_baseline} → ${delta.overall_target}  ${overallDir}\n`)

      delta.entries.forEach((e: EvalEntryDelta) => {
        const icon = e.status === 'improved' ? chalk.green('▲') :
                     e.status === 'regressed' ? chalk.red('▼') :
                     e.status === 'new' ? chalk.blue('+') :
                     e.status === 'removed' ? chalk.gray('-') : chalk.gray('=')
        const scores = e.baseline_score !== null && e.target_score !== null
          ? `${e.baseline_score} → ${e.target_score} (${e.delta! > 0 ? '+' : ''}${e.delta})`
          : e.status === 'new' ? `new: ${e.target_score}` : `removed: ${e.baseline_score}`
        console.log(`  ${icon} ${e.id.padEnd(30)} ${scores}`)
      })
    })
}
```

- [ ] **Step 7: Rewrite `cli/src/index.ts`**

```typescript
#!/usr/bin/env node
import { Command } from 'commander'
import { makePushCommand } from './commands/push'
import { makePullCommand } from './commands/pull'
import { makeListCommand } from './commands/list'
import { makeEvalCommand } from './commands/eval'

const program = new Command()

program
  .name('agent')
  .description('Agent Registry CLI — push, pull, list, and compare agent versions')
  .version('1.0.0')

program.addCommand(makePushCommand())
program.addCommand(makePullCommand())
program.addCommand(makeListCommand())
program.addCommand(makeEvalCommand())

program.parse()
```

- [ ] **Step 8: Verify CLI builds**

```bash
npm run build --workspace=cli
```

Expected: `cli/dist/index.js` with no errors.

- [ ] **Step 9: Run the demo flow end-to-end**

Make sure server is running (`npm run dev --workspace=server`), then:

```bash
# Push v1.0.0
npx ts-node cli/src/index.ts push manifests/summarizer-agent-1.0.0.yaml
# Expected: ✓ summarizer-agent@1.0.0 published successfully

# Push v1.1.0 (non-breaking — adds optional fields)
npx ts-node cli/src/index.ts push manifests/summarizer-agent-1.1.0.yaml
# Expected: ✓ summarizer-agent@1.1.0 published successfully

# Push v1.2.0 (BREAKING — removes required text field)
npx ts-node cli/src/index.ts push manifests/summarizer-agent-1.2.0-breaking.yaml
# Expected: ✗ Push rejected: Breaking schema change detected
#           • [inputs.text] Required input field "text" was removed

# Push v2.0.0 (same breaking change but major bump — accepted)
npx ts-node cli/src/index.ts push manifests/summarizer-agent-2.0.0.yaml
# Expected: ✓ summarizer-agent@2.0.0 published successfully

# Push classifier-agent
npx ts-node cli/src/index.ts push manifests/classifier-agent-1.0.0.yaml
# Expected: ✓ classifier-agent@1.0.0 published successfully

# List all agents
npx ts-node cli/src/index.ts list
# Expected: catalog showing summarizer-agent@2.0.0 and classifier-agent@1.0.0

# Pull v1.1.0 (parallel with 2.0.0)
npx ts-node cli/src/index.ts pull summarizer-agent@1.1.0 --team platform-team
# Expected: ✓ Pulled + manifest JSON

# Eval delta
npx ts-node cli/src/index.ts eval summarizer-agent@2.0.0 --baseline 1.1.0
# Expected: score comparison table
```

- [ ] **Step 10: Commit**

```bash
git add cli/src/
git commit -m "feat: CLI commands — push, pull, list, eval with colored output"
```

---

## Task 8b: CLI `agent run` — Execute an Agent Using Its Manifest Contract

**Files:**
- Create: `cli/src/commands/run.ts`
- Modify: `cli/src/index.ts` (add run command)

**Interfaces:**
- Consumes: manifest from registry via `agent pull`; Anthropic SDK
- Produces: `agent run <name>@<version> --input '{"text":"..."}'` that calls Claude and returns output shaped to manifest contract

**Dependencies:** `ANTHROPIC_API_KEY` env var required

- [ ] **Step 1: Install Anthropic SDK in CLI**

```bash
npm install @anthropic-ai/sdk --workspace=cli
```

- [ ] **Step 2: Create `cli/src/commands/run.ts`**

```typescript
import { Command } from 'commander'
import chalk from 'chalk'
import Anthropic from '@anthropic-ai/sdk'
import { http } from '../http'

interface ManifestInputs {
  required?: string[]
  properties: Record<string, { type: string; description?: string }>
}

interface ManifestOutputs {
  required?: string[]
  properties: Record<string, { type: string; description?: string }>
}

interface AgentManifest {
  name: string
  version: string
  description: string
  model_recommendations?: string[]
  inputs: ManifestInputs
  outputs: ManifestOutputs
}

export function makeRunCommand(): Command {
  return new Command('run')
    .argument('<ref>', 'Agent reference in format name@version')
    .requiredOption('-i, --input <json>', 'Input JSON string matching the manifest input schema')
    .description('Run an agent using its manifest contract — calls Claude with the declared schema')
    .action(async (ref: string, options: { input: string }) => {
      const [name, version] = ref.split('@')
      if (!name || !version) {
        console.error(chalk.red('Invalid ref. Use name@version'))
        process.exit(1)
      }

      // 1. Pull manifest from registry
      let manifest: AgentManifest
      try {
        const res = await http.get(`/agents/${name}/${version}`)
        manifest = res.data as AgentManifest
      } catch {
        console.error(chalk.red(`✗ Could not pull ${name}@${version} from registry`))
        process.exit(1)
      }

      // 2. Parse and validate input
      let input: Record<string, unknown>
      try {
        input = JSON.parse(options.input)
      } catch {
        console.error(chalk.red('✗ Invalid JSON input'))
        process.exit(1)
      }

      const required = manifest.inputs.required ?? []
      const missing = required.filter(f => !(f in input))
      if (missing.length > 0) {
        console.error(chalk.red(`✗ Missing required inputs: ${missing.join(', ')}`))
        process.exit(1)
      }

      // 3. Build prompt from manifest contract
      const model = manifest.model_recommendations?.[0] ?? 'claude-sonnet-4-6'
      const outputFields = Object.keys(manifest.outputs.properties)
      const outputRequired = manifest.outputs.required ?? []

      const systemPrompt = [
        `You are ${manifest.name} v${manifest.version}: ${manifest.description}`,
        `You MUST respond with a valid JSON object containing these fields:`,
        outputRequired.map(f => {
          const def = manifest.outputs.properties[f]
          return `  - "${f}" (${def?.type ?? 'string'}): required`
        }).join('\n'),
        outputFields.filter(f => !outputRequired.includes(f)).map(f => {
          const def = manifest.outputs.properties[f]
          return `  - "${f}" (${def?.type ?? 'string'}): optional`
        }).join('\n'),
        `Respond ONLY with the JSON object. No explanation, no markdown.`
      ].filter(Boolean).join('\n')

      const userMessage = Object.entries(input)
        .map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`)
        .join('\n')

      // 4. Call Claude
      console.log(chalk.gray(`\nRunning ${name}@${version} with model ${model}...\n`))

      const client = new Anthropic()
      const response = await client.messages.create({
        model,
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }]
      })

      const rawText = response.content[0].type === 'text' ? response.content[0].text : ''

      // 5. Parse and display output
      try {
        const output = JSON.parse(rawText)
        console.log(chalk.green(`✓ ${name}@${version} responded:\n`))
        console.log(JSON.stringify(output, null, 2))
      } catch {
        console.log(chalk.yellow('Response (raw):'))
        console.log(rawText)
      }
    })
}
```

- [ ] **Step 3: Add run command to `cli/src/index.ts`**

Add import and `program.addCommand(makeRunCommand())` alongside the other commands.

- [ ] **Step 4: Verify build**

```bash
npm run build --workspace=cli
```

- [ ] **Step 5: Smoke test**

With server running and agents pushed:
```bash
ANTHROPIC_API_KEY=your-key npx ts-node cli/src/index.ts run summarizer-agent@1.1.0 \
  --input '{"text": "The quick brown fox jumps over the lazy dog. It was a sunny day."}'
```

Expected:
```json
{
  "summary": "A fox jumps over a dog on a sunny day."
}
```

- [ ] **Step 6: Commit**

```bash
git add cli/src/commands/run.ts cli/src/index.ts
git commit -m "feat(cli): agent run — execute agent via manifest contract using Claude"
```

---

## Task 9: React Dashboard — Catalog + Agent Detail

**Files:**
- Create: `client/src/api.ts`
- Create: `client/src/App.tsx`
- Create: `client/src/components/CatalogView.tsx`
- Create: `client/src/components/AgentDetail.tsx`
- Create: `client/src/components/SchemaDiff.tsx`
- Create: `client/src/main.tsx`
- Create: `client/src/index.css`

**Interfaces:**
- Consumes: server API at `/api/*` (proxied by Vite)
- Produces: browseable dashboard at `http://localhost:3000`

- [ ] **Step 1: Create `client/src/index.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 2: Create `client/src/api.ts`**

```typescript
const BASE = '/api'

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
  const res = await fetch(`${BASE}/agents/${name}/${version}`)
  return res.json()
}

export async function fetchVersions(name: string): Promise<string[]> {
  const res = await fetch(`${BASE}/agents/${name}/versions`)
  const data = await res.json()
  return data.versions
}

export async function fetchEvalDelta(name: string, version: string, baseline: string): Promise<EvalDelta> {
  const res = await fetch(`${BASE}/agents/${name}/${version}/eval-delta?baseline=${baseline}`)
  return res.json()
}

export async function fetchTeamMetrics(): Promise<TeamMetric[]> {
  const res = await fetch(`${BASE}/metrics/teams`)
  return res.json()
}
```

- [ ] **Step 3: Create `client/src/components/CatalogView.tsx`**

```tsx
import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchCatalog, CatalogEntry } from '../api'

export default function CatalogView() {
  const [agents, setAgents] = useState<CatalogEntry[]>([])

  useEffect(() => { fetchCatalog().then(setAgents) }, [])

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Agent Registry</h1>
      <p className="text-gray-500 mb-8">{agents.length} agents published</p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {agents.map(agent => (
          <Link
            key={agent.name}
            to={`/agents/${agent.name}`}
            className="block border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow bg-white"
          >
            <div className="flex items-start justify-between mb-2">
              <h2 className="font-semibold text-gray-900 text-lg">{agent.name}</h2>
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-mono">
                v{agent.latest_version}
              </span>
            </div>
            <p className="text-gray-500 text-sm mb-3">{agent.description}</p>
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <span className="bg-gray-100 px-2 py-0.5 rounded">team: {agent.author_team}</span>
              <span>{agent.versions.length} version{agent.versions.length !== 1 ? 's' : ''}</span>
            </div>
            {agent.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {agent.tags.map(tag => (
                  <span key={tag} className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </Link>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create `client/src/components/SchemaDiff.tsx`**

```tsx
import React from 'react'
import { AgentManifest } from '../api'

interface Props {
  baseline: AgentManifest
  target: AgentManifest
}

function FieldRow({ field, baseType, targetType, required }: {
  field: string; baseType?: string; targetType?: string; required: boolean
}) {
  const changed = baseType && targetType && baseType !== targetType
  const added = !baseType && targetType
  const removed = baseType && !targetType
  const bg = changed || removed ? 'bg-red-50' : added ? 'bg-green-50' : ''

  return (
    <tr className={bg}>
      <td className="px-3 py-1.5 text-sm font-mono text-gray-800">
        {field} {required && <span className="text-red-500 text-xs">*</span>}
      </td>
      <td className="px-3 py-1.5 text-sm font-mono text-gray-500">{baseType ?? '—'}</td>
      <td className="px-3 py-1.5 text-sm font-mono">
        {removed ? <span className="text-red-600">removed</span> :
         added ? <span className="text-green-600">{targetType} (new)</span> :
         changed ? <span className="text-red-600">{targetType} ⚠ changed</span> :
         <span className="text-gray-500">{targetType}</span>}
      </td>
    </tr>
  )
}

export default function SchemaDiff({ baseline, target }: Props) {
  const allInputFields = new Set([
    ...Object.keys(baseline.inputs.properties),
    ...Object.keys(target.inputs.properties)
  ])
  const allOutputFields = new Set([
    ...Object.keys(baseline.outputs.properties),
    ...Object.keys(target.outputs.properties)
  ])
  const targetRequired = new Set(target.inputs.required ?? [])

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">Inputs</h3>
        <table className="w-full text-left border border-gray-100 rounded-lg overflow-hidden">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
            <tr>
              <th className="px-3 py-2">Field</th>
              <th className="px-3 py-2">v{baseline.version}</th>
              <th className="px-3 py-2">v{target.version}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {[...allInputFields].map(field => (
              <FieldRow
                key={field}
                field={field}
                baseType={baseline.inputs.properties[field]?.type}
                targetType={target.inputs.properties[field]?.type}
                required={targetRequired.has(field)}
              />
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">Outputs</h3>
        <table className="w-full text-left border border-gray-100 rounded-lg overflow-hidden">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
            <tr>
              <th className="px-3 py-2">Field</th>
              <th className="px-3 py-2">v{baseline.version}</th>
              <th className="px-3 py-2">v{target.version}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {[...allOutputFields].map(field => (
              <FieldRow
                key={field}
                field={field}
                baseType={baseline.outputs.properties[field]?.type}
                targetType={target.outputs.properties[field]?.type}
                required={false}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Create `client/src/components/AgentDetail.tsx`**

```tsx
import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { fetchManifest, fetchVersions, fetchEvalDelta, AgentManifest, EvalDelta } from '../api'
import SchemaDiff from './SchemaDiff'
import EvalDeltaView from './EvalDelta'

export default function AgentDetail() {
  const { name } = useParams<{ name: string }>()
  const [versions, setVersions] = useState<string[]>([])
  const [selectedVersion, setSelectedVersion] = useState<string>('')
  const [baselineVersion, setBaselineVersion] = useState<string>('')
  const [manifest, setManifest] = useState<AgentManifest | null>(null)
  const [baselineManifest, setBaselineManifest] = useState<AgentManifest | null>(null)
  const [evalDelta, setEvalDelta] = useState<EvalDelta | null>(null)

  useEffect(() => {
    if (!name) return
    fetchVersions(name).then(v => {
      setVersions(v)
      const latest = v.at(-1) ?? ''
      setSelectedVersion(latest)
      if (v.length >= 2) setBaselineVersion(v.at(-2) ?? '')
    })
  }, [name])

  useEffect(() => {
    if (!name || !selectedVersion) return
    fetchManifest(name, selectedVersion).then(setManifest)
  }, [name, selectedVersion])

  useEffect(() => {
    if (!name || !baselineVersion) return
    fetchManifest(name, baselineVersion).then(setBaselineManifest)
  }, [name, baselineVersion])

  useEffect(() => {
    if (!name || !selectedVersion || !baselineVersion || selectedVersion === baselineVersion) return
    fetchEvalDelta(name, selectedVersion, baselineVersion)
      .then(setEvalDelta)
      .catch(() => setEvalDelta(null))
  }, [name, selectedVersion, baselineVersion])

  if (!manifest) return <div className="p-8 text-gray-500">Loading...</div>

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{name}</h1>
        <p className="text-gray-500 mt-1">{manifest.description}</p>
        <div className="flex gap-2 mt-2 text-sm text-gray-400">
          <span>team: {manifest.author_team}</span>
          {manifest.model_recommendations && (
            <span>· models: {manifest.model_recommendations.join(', ')}</span>
          )}
        </div>
      </div>

      {/* Version selector */}
      <div className="flex gap-4 mb-8">
        <div>
          <label className="text-xs text-gray-500 block mb-1">Target version</label>
          <select
            value={selectedVersion}
            onChange={e => setSelectedVersion(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm"
          >
            {versions.map(v => <option key={v}>{v}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Baseline (compare against)</label>
          <select
            value={baselineVersion}
            onChange={e => setBaselineVersion(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm"
          >
            {versions.map(v => <option key={v}>{v}</option>)}
          </select>
        </div>
      </div>

      {/* Schema diff */}
      {baselineManifest && selectedVersion !== baselineVersion && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Schema Diff</h2>
          <SchemaDiff baseline={baselineManifest} target={manifest} />
        </div>
      )}

      {/* Eval delta */}
      {evalDelta && selectedVersion !== baselineVersion && (
        <div>
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Eval Delta</h2>
          <EvalDeltaView delta={evalDelta} />
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 6: Commit**

```bash
git add client/src/
git commit -m "feat: dashboard catalog view + agent detail with schema diff"
```

---

## Task 10: Dashboard — Eval Delta + Team Metrics Views

**Files:**
- Create: `client/src/components/EvalDelta.tsx`
- Create: `client/src/components/TeamMetrics.tsx`
- Modify: `client/src/App.tsx`

- [ ] **Step 1: Create `client/src/components/EvalDelta.tsx`**

```tsx
import React from 'react'
import { EvalDelta } from '../api'

export default function EvalDeltaView({ delta }: { delta: EvalDelta }) {
  const overallDelta = delta.overall_delta
  const deltaColor = overallDelta === null ? 'text-gray-400' :
                     overallDelta > 0 ? 'text-green-600' : 'text-red-600'

  return (
    <div>
      <div className="flex gap-8 mb-4 p-4 bg-gray-50 rounded-lg">
        <div>
          <div className="text-xs text-gray-500">Baseline v{delta.baseline_version}</div>
          <div className="text-2xl font-bold">{delta.overall_baseline?.toFixed(2) ?? '—'}</div>
        </div>
        <div className="text-2xl text-gray-300 self-center">→</div>
        <div>
          <div className="text-xs text-gray-500">Target v{delta.target_version}</div>
          <div className="text-2xl font-bold">{delta.overall_target?.toFixed(2) ?? '—'}</div>
        </div>
        <div className="self-center">
          <span className={`text-xl font-bold ${deltaColor}`}>
            {overallDelta !== null ? `${overallDelta > 0 ? '+' : ''}${overallDelta.toFixed(4)}` : '—'}
          </span>
        </div>
      </div>

      <table className="w-full text-left border border-gray-100 rounded-lg overflow-hidden">
        <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
          <tr>
            <th className="px-3 py-2">Eval ID</th>
            <th className="px-3 py-2">Baseline</th>
            <th className="px-3 py-2">Target</th>
            <th className="px-3 py-2">Delta</th>
            <th className="px-3 py-2">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {delta.entries.map(e => {
            const statusColor = e.status === 'improved' ? 'text-green-600 bg-green-50' :
                               e.status === 'regressed' ? 'text-red-600 bg-red-50' :
                               e.status === 'new' ? 'text-blue-600 bg-blue-50' :
                               'text-gray-500 bg-gray-50'
            return (
              <tr key={e.id}>
                <td className="px-3 py-2 text-sm font-mono">{e.id}</td>
                <td className="px-3 py-2 text-sm">{e.baseline_score?.toFixed(2) ?? '—'}</td>
                <td className="px-3 py-2 text-sm">{e.target_score?.toFixed(2) ?? '—'}</td>
                <td className="px-3 py-2 text-sm font-mono">
                  {e.delta !== null ? `${e.delta > 0 ? '+' : ''}${e.delta}` : '—'}
                </td>
                <td className="px-3 py-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor}`}>
                    {e.status}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 2: Create `client/src/components/TeamMetrics.tsx`**

```tsx
import React, { useEffect, useState } from 'react'
import { fetchTeamMetrics, TeamMetric } from '../api'

export default function TeamMetrics() {
  const [metrics, setMetrics] = useState<TeamMetric[]>([])

  useEffect(() => { fetchTeamMetrics().then(setMetrics) }, [])

  const maxAuthored = Math.max(...metrics.map(m => m.agents_authored), 1)

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Team Metrics</h1>
      <p className="text-gray-500 mb-8">
        Reuse ratio = agents pulled from other teams / total agents touched per team
      </p>

      {metrics.length === 0 ? (
        <p className="text-gray-400">No data yet — pull some agents with <code className="bg-gray-100 px-1 rounded">--team</code> flag</p>
      ) : (
        <div className="space-y-6">
          {metrics.map(m => (
            <div key={m.team} className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-gray-900">{m.team}</h2>
                <span className="text-sm font-mono bg-blue-50 text-blue-700 px-3 py-1 rounded-full">
                  {Math.round(m.reuse_ratio * 100)}% reuse ratio
                </span>
              </div>
              <div className="flex gap-6 text-sm text-gray-600 mb-4">
                <span>✍ {m.agents_authored} authored</span>
                <span>♻ {m.agents_reused} reused</span>
              </div>
              {/* Authored bar */}
              <div className="mb-2">
                <div className="text-xs text-gray-400 mb-1">Authored</div>
                <div className="h-2 bg-gray-100 rounded-full">
                  <div
                    className="h-2 bg-blue-500 rounded-full"
                    style={{ width: `${(m.agents_authored / maxAuthored) * 100}%` }}
                  />
                </div>
              </div>
              {/* Reused bar */}
              <div>
                <div className="text-xs text-gray-400 mb-1">Reused (from other teams)</div>
                <div className="h-2 bg-gray-100 rounded-full">
                  <div
                    className="h-2 bg-green-500 rounded-full"
                    style={{ width: `${(m.agents_reused / maxAuthored) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Create `client/src/App.tsx`**

```tsx
import React from 'react'
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom'
import CatalogView from './components/CatalogView'
import AgentDetail from './components/AgentDetail'
import TeamMetrics from './components/TeamMetrics'

function Nav() {
  const loc = useLocation()
  const linkClass = (path: string) =>
    `px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
      loc.pathname === path
        ? 'bg-blue-600 text-white'
        : 'text-gray-600 hover:bg-gray-100'
    }`
  return (
    <nav className="border-b border-gray-200 bg-white px-8 py-3 flex items-center gap-2">
      <span className="font-bold text-gray-900 mr-6">⬡ Agent Registry</span>
      <Link to="/" className={linkClass('/')}>Catalog</Link>
      <Link to="/metrics" className={linkClass('/metrics')}>Team Metrics</Link>
    </nav>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50">
        <Nav />
        <Routes>
          <Route path="/" element={<CatalogView />} />
          <Route path="/agents/:name" element={<AgentDetail />} />
          <Route path="/metrics" element={<TeamMetrics />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}
```

- [ ] **Step 4: Update `client/src/main.tsx` with CSS import**

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

- [ ] **Step 5: Add postcss config for Tailwind**

`client/postcss.config.js`:
```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {}
  }
}
```

- [ ] **Step 6: Start full stack and verify dashboard**

```bash
npm run dev
```

Open `http://localhost:3000` — should show the Agent Registry catalog with all pushed agents.  
Navigate to an agent — should show version selector, schema diff, eval delta.  
Navigate to `/metrics` — should show team bars (push agents with different `--team` flags first if empty).

- [ ] **Step 7: Commit**

```bash
git add client/src/
git commit -m "feat: dashboard eval delta view + team metrics with reuse ratio bars"
```

---

## Task 10b: Eval Execution on Push (added 2026-07-04)

**Goal:** Replace publisher-declared eval scores with registry-computed ones. At push time, the server runs each `eval_suite` case against Claude using the manifest contract, scores it, and persists the computed scores in the stored manifest. Upgrades the story from "trust the publisher" to "the registry verifies."

**Files:**
- Create: `server/src/agent-executor.ts` — contract-execution logic (manifest → system prompt → Claude call → parse JSON), extracted/adapted from `cli/src/commands/run.ts`
- Create: `server/src/eval-runner.ts` — loops over `eval_suite`, executes each case, computes scores
- Modify: `server/src/routes/agents.ts` — push route runs evals when enabled, writes computed scores into manifest before persisting
- Modify: `cli/src/commands/push.ts` — add `--eval` flag; display per-case results returned by server
- Modify: `.env.example` — document server-side `ANTHROPIC_API_KEY` + `EVAL_ON_PUSH`

**Interfaces:**
- Consumes: Anthropic SDK (server-side), existing manifest contract
- Produces: manifests stored with computed (not declared) eval scores; push output showing live eval runs

**Design decisions:**
- Scoring (PoC): a case passes if the response is valid JSON containing all `expected_output_contains` fields — score 1.0/0.0 (or fraction of fields present). LLM-judge rubric = future work, mention in article.
- Behind a flag: `agent push --eval` or `EVAL_ON_PUSH=true`. Without flag/key, declared scores are kept as fallback — demo stays runnable without an API key.
- Use a small/fast model (haiku) for eval calls — cost per push is fractions of a cent (2-3 cases × 1 short call).
- Eval delta computation (`eval.ts`) unchanged — it consumes scores regardless of origin.
- Server needs `ANTHROPIC_API_KEY` in env (dotenv, same `.env` at repo root).

**Ordering rationale:** must land BEFORE Task 11 (README + DEMO.md) so docs describe the final push behavior; after Tasks 9-10 so FE work isn't blocked.

**Verification:**
```bash
# with ANTHROPIC_API_KEY set and server running, fresh registry
npx ts-node cli/src/index.ts push manifests/summarizer-agent-1.0.0.yaml --eval
# Expected: per-case live results (e.g. ✓ short-text 1.0, ✓ technical-doc 1.0) and
# stored manifest at server/data/manifests/summarizer-agent/1.0.0.yaml contains computed scores
```

---

## Task 11: README + Demo Script

**Files:**
- Create: `README.md`
- Create: `DEMO.md`

- [ ] **Step 1: Create `README.md`**

```markdown
# Agent Registry

A discoverable catalog for AI agents with versioning, schema-on-push validation, eval delta reports, and team reuse metrics — built for LIT-38.

## Quick Start

```bash
npm install
npm run dev          # starts server (:3001) + dashboard (:3000)
```

## CLI

```bash
# Push an agent manifest
npx ts-node cli/src/index.ts push manifests/summarizer-agent-1.0.0.yaml

# Pull a specific version
npx ts-node cli/src/index.ts pull summarizer-agent@1.1.0 --team my-team

# List all agents
npx ts-node cli/src/index.ts list

# Eval delta between versions
npx ts-node cli/src/index.ts eval summarizer-agent@2.0.0 --baseline 1.1.0
```

## Architecture

- **Server** (`server/`) — Express + SQLite. Stores manifests as YAML files, enforces schema rules on push.
- **CLI** (`cli/`) — TypeScript Commander CLI. push/pull/list/eval commands.
- **Dashboard** (`client/`) — React + Tailwind. Catalog, schema diffs, eval deltas, team metrics.

## Key Features

- `agent@Major.Minor.Patch` semver versioning
- Breaking schema change rejected on push (no major bump = no breaking changes)
- Parallel version coexistence — any version remains pullable
- Eval delta report between any two versions
- Team reuse ratio: `agents_reused / (agents_authored + agents_reused)` per team
```

- [ ] **Step 2: Create `DEMO.md`**

```markdown
# Demo Script — LIT-38 Agent Registry

## Setup (before demo)

```bash
npm install && npm run dev
# Server: http://localhost:3001
# Dashboard: http://localhost:3000
```

## AC#1 — Parallel versions + eval delta

```bash
# Publish 1.0.0
npx ts-node cli/src/index.ts push manifests/summarizer-agent-1.0.0.yaml

# Publish 1.1.0 (non-breaking — adds language field)
npx ts-node cli/src/index.ts push manifests/summarizer-agent-1.1.0.yaml

# Both versions still pullable in parallel
npx ts-node cli/src/index.ts pull summarizer-agent@1.0.0 --team team-a
npx ts-node cli/src/index.ts pull summarizer-agent@1.1.0 --team team-b

# Show eval delta: 1.1.0 improved scores + added multilingual eval
npx ts-node cli/src/index.ts eval summarizer-agent@1.1.0 --baseline 1.0.0
```

## AC#2 — Breaking change rejected

```bash
# This removes required "text" input — same major version → REJECTED
npx ts-node cli/src/index.ts push manifests/summarizer-agent-1.2.0-breaking.yaml
# Output: ✗ Push rejected: Breaking schema change detected
#         • [inputs.text] Required input field "text" was removed

# Major bump → ACCEPTED
npx ts-node cli/src/index.ts push manifests/summarizer-agent-2.0.0.yaml
# Output: ✓ summarizer-agent@2.0.0 published successfully

# Show eval delta 2.0.0 vs 1.1.0 in dashboard
```

## AC#3 — Reuse ratio

```bash
# team-a authored summarizer, team-b pulls it (reuse)
npx ts-node cli/src/index.ts push manifests/classifier-agent-1.0.0.yaml  # pushed by platform-team (in manifest)
npx ts-node cli/src/index.ts pull classifier-agent@1.0.0 --team aisdlc  # aisdlc reusing

# Open http://localhost:3000/metrics to show reuse ratio bars
```

## Dashboard walkthrough

1. `http://localhost:3000` — Catalog: show all agents, latest versions, tags
2. Click `summarizer-agent` — version selector, schema diff (1.1.0 vs 2.0.0 shows breaking changes highlighted in red), eval delta table
3. `http://localhost:3000/metrics` — team bars showing authored vs reused
```

- [ ] **Step 3: Final commit**

```bash
git add README.md DEMO.md
git commit -m "docs: README and demo script for LIT-38 PoC"
```

---

## Self-Review

### Spec Coverage

| AC | Covered by |
|---|---|
| AC#1: publish 1.2.0, 1.1.0 keeps running, eval delta | Task 6 (push/pull endpoints) + Task 8 (CLI eval) + Task 10 (EvalDelta view) |
| AC#2: breaking schema rejected without major bump | Task 4 (schema-diff.ts) + Task 6 (push route) + Task 8 (push CLI error output) |
| AC#3: reuse-vs-authored per team | Task 3 (db.ts getTeamMetrics) + Task 6 (metrics route) + Task 10 (TeamMetrics view) |
| AC#4: working PoC demo | Task 11 (DEMO.md) + full stack running |
| AC#5: article material | State-of-the-art file + DEMO.md + learnings documented as built |

### No Placeholders ✓
All steps have exact code, exact commands, exact expected output.

### Type Consistency ✓
- `AgentManifest` defined in Task 2, imported everywhere
- `EvalDelta` / `EvalEntryDelta` defined in Task 5, imported in CLI and client
- `TeamMetric` defined in Task 3, used in metrics route and client

---

---

## Task 12: Deploy to Render + Vercel + Supabase

**Goal:** Swap local storage for Supabase, deploy server to Render, dashboard to Vercel. Same behavior as local — just a live public URL.

**Files:**
- Create: `render.yaml`
- Create: `server/.env.example`
- Modify: `server/src/storage.ts` — add Supabase Storage adapter behind env flag
- Modify: `server/src/db.ts` — add Supabase PostgreSQL adapter behind env flag
- Modify: `client/vite.config.ts` — add `VITE_API_URL` for production

**Supabase setup (run once in Supabase dashboard):**

SQL migration to run in Supabase SQL editor:
```sql
CREATE TABLE pushes (
  id SERIAL PRIMARY KEY,
  agent_name TEXT NOT NULL,
  version TEXT NOT NULL,
  author_team TEXT NOT NULL,
  pushed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE pulls (
  id SERIAL PRIMARY KEY,
  agent_name TEXT NOT NULL,
  version TEXT NOT NULL,
  pulling_team TEXT NOT NULL,
  pulled_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Create a Supabase Storage bucket named `manifests` (public read, authenticated write).

**Environment variables for Render:**
```
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_KEY=<service_role_key>
NODE_ENV=production
```

**Environment variables for Vercel:**
```
VITE_API_URL=https://<your-render-service>.onrender.com
```

- [ ] **Step 1: Create `render.yaml`**

```yaml
services:
  - type: web
    name: agent-registry-server
    env: node
    buildCommand: npm install && npm run build --workspace=server
    startCommand: node server/dist/index.js
    envVars:
      - key: SUPABASE_URL
        sync: false
      - key: SUPABASE_SERVICE_KEY
        sync: false
      - key: NODE_ENV
        value: production
```

- [ ] **Step 2: Add Supabase dependency to server**

```bash
npm install @supabase/supabase-js --workspace=server
```

- [ ] **Step 3: Update `server/src/storage.ts` to support both local and Supabase**

Add Supabase Storage adapter — when `SUPABASE_URL` is set, use Supabase; otherwise use filesystem (local dev unchanged).

- [ ] **Step 4: Update `server/src/db.ts` to support both SQLite and Supabase PostgreSQL**

When `SUPABASE_URL` is set, use Supabase client for queries; otherwise use better-sqlite3 (local dev unchanged).

- [ ] **Step 5: Create `server/.env.example`**

```
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_KEY=<service_role_key>
AGENT_REGISTRY_URL=http://localhost:3001
```

- [ ] **Step 6: Push to GitHub and deploy**

```bash
git push origin main
```

- Connect repo to Render → new Web Service → set env vars
- Connect repo to Vercel → new project → set `VITE_API_URL` to Render URL
- Run Supabase SQL migration in dashboard

- [ ] **Step 7: Re-run demo flow against live URLs**

```bash
AGENT_REGISTRY_URL=https://<render-url>.onrender.com \
  npx ts-node cli/src/index.ts push manifests/summarizer-agent-1.0.0.yaml
```

Open Vercel URL → confirm catalog shows the pushed agent.

- [ ] **Step 8: Commit**

```bash
git add render.yaml server/.env.example
git commit -m "feat: Render + Vercel + Supabase deployment config"
```

---

## Execution Options

Plan saved to `docs/superpowers/plans/2026-06-29-lit-38-agent-registry.md`.

**Two execution options:**

**1. Subagent-Driven (recommended)** — Fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session with checkpoints

Which approach?
