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
