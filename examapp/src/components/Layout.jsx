import React, { useState } from 'react'
import { Outlet, Link, useLocation } from 'react-router-dom'
import { Menu, X, Zap, Settings } from 'lucide-react'
import { getUserApiKey } from '../pages/Settings'

export default function Layout() {
  const [menuOpen, setMenuOpen] = useState(false)
  const loc = useLocation()

  const navLinks = [
    { to: '/', label: 'Dashboard' },
    { to: '/upload', label: 'Upload PDF' },
    { to: '/omr', label: 'OMR Scan' },
  ]

  const hasUserKey = !!getUserApiKey()

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <nav className="glass sticky top-0 z-50 border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-14">
          <Link to="/" className="flex items-center gap-2 font-display text-2xl text-orange-500 tracking-wider">
            <Zap size={22} className="text-orange-500" />
            EXAMPREP
          </Link>
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map(l => (
              <Link key={l.to} to={l.to}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                  loc.pathname === l.to
                    ? 'bg-orange-100 text-orange-600'
                    : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'
                }`}>
                {l.label}
              </Link>
            ))}
            <Link to="/settings"
              className={`ml-1 px-3 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-1.5 ${
                loc.pathname === '/settings'
                  ? 'bg-orange-100 text-orange-600'
                  : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'
              }`}>
              <Settings size={14} />
              API Key
              {hasUserKey && <span className="w-2 h-2 rounded-full bg-green-400 inline-block" title="Your API key active" />}
            </Link>
          </div>
          <button className="md:hidden p-2 rounded-lg text-gray-500" onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
        {menuOpen && (
          <div className="md:hidden border-t border-gray-200 px-4 py-3 flex flex-col gap-1 bg-white">
            {navLinks.map(l => (
              <Link key={l.to} to={l.to} onClick={() => setMenuOpen(false)}
                className={`px-4 py-2.5 rounded-lg text-sm font-semibold ${
                  loc.pathname === l.to ? 'bg-orange-100 text-orange-600' : 'text-gray-600'
                }`}>
                {l.label}
              </Link>
            ))}
            <Link to="/settings" onClick={() => setMenuOpen(false)}
              className={`px-4 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-2 ${
                loc.pathname === '/settings' ? 'bg-orange-100 text-orange-600' : 'text-gray-600'
              }`}>
              <Settings size={14} /> API Key Settings
              {hasUserKey && <span className="w-2 h-2 rounded-full bg-green-400" />}
            </Link>
          </div>
        )}
      </nav>
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6">
        <Outlet />
      </main>
      <footer className="border-t border-gray-200 text-center text-xs text-gray-400 py-4 bg-white">
        ExamPrep CBT · PDF → Question Bank → Exam Interface
      </footer>
    </div>
  )
}
