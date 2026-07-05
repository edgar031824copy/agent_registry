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
