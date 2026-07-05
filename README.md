# Agent Registry

A discoverable catalog for AI agents with versioning — like Docker Hub, but for agents. Teams publish agent manifests with `agent push`, consume them with `agent pull`, and the registry enforces schema rules on push. Built for LIT-38.

**Two things no existing registry does:**

1. **Breaking schema changes are rejected on push** unless the major version is bumped — semver as a consent mechanism, enforced by the registry.
2. **Structured eval deltas between versions** — before migrating, consumers see exactly which eval cases improved or regressed.

## Quick Start

```bash
npm install
cp .env.example .env      # add your ANTHROPIC_API_KEY (needed for `agent run` and push --eval)
npm run dev               # server on :3001 + dashboard on :3000
```

## CLI

```bash
# Publish an agent manifest
npx ts-node cli/src/index.ts push manifests/summarizer-agent-1.0.0.yaml

# Publish AND have the registry run the eval suite live, storing measured scores
npx ts-node cli/src/index.ts push manifests/summarizer-agent-1.0.0.yaml --eval

# Pull a specific version (--team records the pull for reuse metrics)
npx ts-node cli/src/index.ts pull summarizer-agent@1.1.0 --team my-team

# List all agents, or all versions of one
npx ts-node cli/src/index.ts list
npx ts-node cli/src/index.ts list summarizer-agent

# Eval delta between two versions
npx ts-node cli/src/index.ts eval summarizer-agent@2.0.0 --baseline 1.1.0

# Execute an agent directly from its manifest contract (calls Claude)
npx ts-node cli/src/index.ts run summarizer-agent@1.1.0 --input '{"text": "..."}'

# Reset the registry to empty (safe while the server is running)
npm run registry:reset
```

## Architecture

```
manifests/*.yaml                      your local source files (the "Dockerfiles")
      │  agent push
      ▼
server (Express :3001)                validate shape → diff schemas → [optional: run evals] → store
      ├── server/data/manifests/      accepted manifests (the registry's source of truth)
      └── server/data/registry.db     push/pull events (SQLite) → team reuse metrics
      ▲
      │  /api proxy
client (React + Tailwind :3000)       catalog · schema diff · eval delta · team metrics
```

- **Server** (`server/`) — Express + better-sqlite3. Manifests stored as YAML files, events in SQLite.
- **CLI** (`cli/`) — Commander. Thin client: all business logic lives in the server.
- **Dashboard** (`client/`) — React + Tailwind + Vite (dev proxy `/api` → `:3001`).

## The Manifest

A manifest is a **contract, not code** — like an OpenAPI spec for an agent: name, semver version, input/output JSON schemas, recommended models, and an eval suite. `agent run` proves the contract is executable: it builds a system prompt from the output schema and calls Claude — no agent-specific code exists anywhere.

## Key Behaviors

- **Breaking change gate (AC#2):** removing a required input, adding a required input without a default, or changing a field type is rejected with HTTP 422 and named reasons — unless the major version is bumped.
- **Parallel versions (AC#1):** versions are immutable files side by side; publishing 2.0.0 never touches 1.x consumers.
- **Eval scores — declared vs measured:** by default the registry stores the publisher's declared scores. With `push --eval` (or `EVAL_ON_PUSH=true`), the registry executes each eval case against Claude at push time and stores measured contract-compliance scores instead.
- **Reuse metric (AC#3):** `reuse_ratio = agents_reused / (agents_authored + agents_reused)` per team, where reuse = pulling an agent authored by another team.

## Demo

See [DEMO.md](./DEMO.md) for the scripted walkthrough.
