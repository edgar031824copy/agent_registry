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
