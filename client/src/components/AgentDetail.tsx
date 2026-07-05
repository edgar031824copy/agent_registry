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
