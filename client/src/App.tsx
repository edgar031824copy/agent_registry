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
