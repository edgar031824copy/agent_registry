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
  const authored = db.prepare(`
    SELECT author_team as team, COUNT(DISTINCT agent_name) as agents_authored
    FROM pushes GROUP BY author_team
  `).all() as { team: string; agents_authored: number }[]

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
