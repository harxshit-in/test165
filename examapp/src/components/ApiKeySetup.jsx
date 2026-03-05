import React, { useState } from 'react'
import { Key, Eye, EyeOff, ExternalLink, CheckCircle2, X, Info } from 'lucide-react'
import { saveApiKey, clearApiKey, getStoredApiKey } from '../utils/aiExtractor'

export default function ApiKeySetup({ onKeyChange }) {
  const [key, setKey] = useState(getStoredApiKey())
  const [show, setShow] = useState(false)
  const [saved, setSaved] = useState(!!getStoredApiKey())
  const [open, setOpen] = useState(!getStoredApiKey())

  function handleSave() {
    if (!key.trim()) return
    saveApiKey(key.trim())
    setSaved(true)
    setOpen(false)
    onKeyChange?.(key.trim())
  }

  function handleClear() {
    clearApiKey()
    setKey('')
    setSaved(false)
    setOpen(true)
    onKeyChange?.('')
  }

  if (!open && saved) {
    return (
      <div className="flex items-center justify-between px-4 py-3 bg-green-50 border border-green-200 rounded-xl">
        <div className="flex items-center gap-2">
          <CheckCircle2 size={16} className="text-green-500" />
          <span className="text-sm font-semibold text-green-700">AI extraction enabled (Gemini)</span>
          <span className="text-xs text-green-500 font-mono">••••{key.slice(-6)}</span>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setOpen(true)} className="text-xs text-gray-400 hover:text-gray-600 underline">Change</button>
          <button onClick={handleClear} className="p-1 text-gray-300 hover:text-red-400 transition-colors"><X size={14} /></button>
        </div>
      </div>
    )
  }

  return (
    <div className="card p-4 border-orange-200 bg-orange-50">
      <div className="flex items-start gap-3 mb-3">
        <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center shrink-0">
          <Key size={16} className="text-orange-500" />
        </div>
        <div>
          <h3 className="font-bold text-gray-800 text-sm">Enable AI Extraction (Free)</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Uses Google Gemini — free tier: 1,500 requests/day, no credit card needed.
          </p>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3 flex gap-2">
        <Info size={15} className="text-blue-500 shrink-0 mt-0.5" />
        <div className="text-xs text-blue-700 leading-relaxed">
          <strong>Get free API key in 30 seconds:</strong><br />
          1. Visit <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer"
            className="underline font-semibold">aistudio.google.com/app/apikey</a><br />
          2. Click <strong>"Create API Key"</strong><br />
          3. Copy and paste below — that's it!
          <br /><span className="text-blue-500">Your key is stored only in your browser (localStorage). Never sent to our servers.</span>
        </div>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type={show ? 'text' : 'password'}
            placeholder="Paste your Gemini API key here (AIza...)"
            value={key}
            onChange={e => setKey(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSave()}
            className="pr-10 font-mono text-sm"
          />
          <button
            onClick={() => setShow(!show)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            {show ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>
        <button
          onClick={handleSave}
          disabled={!key.trim()}
          className="btn-primary text-sm py-2 px-4 whitespace-nowrap"
        >
          Save Key
        </button>
      </div>

      <div className="flex items-center justify-between mt-2">
        <a
          href="https://aistudio.google.com/app/apikey"
          target="_blank"
          rel="noreferrer"
          className="text-xs text-orange-500 hover:text-orange-700 flex items-center gap-1 underline"
        >
          <ExternalLink size={11} /> Get free API key →
        </a>
        {saved && (
          <button onClick={() => setOpen(false)} className="text-xs text-gray-400 hover:text-gray-600 underline">
            Cancel
          </button>
        )}
      </div>
    </div>
  )
}
