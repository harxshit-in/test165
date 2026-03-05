import React, { useState, useEffect } from 'react'
import { Key, Eye, EyeOff, CheckCircle2, Trash2, ExternalLink, AlertTriangle, Info } from 'lucide-react'

const STORAGE_KEY = 'user_gemini_api_key'

export function getUserApiKey() { return localStorage.getItem(STORAGE_KEY) || '' }
export function setUserApiKey(k) { k ? localStorage.setItem(STORAGE_KEY, k) : localStorage.removeItem(STORAGE_KEY) }

export default function Settings() {
  const [key, setKey] = useState('')
  const [show, setShow] = useState(false)
  const [saved, setSaved] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null) // null | 'ok' | 'fail'

  useEffect(() => {
    const stored = getUserApiKey()
    if (stored) { setKey(stored); setSaved(true) }
  }, [])

  async function testKey(keyToTest) {
    setTesting(true); setTestResult(null)
    try {
      // Send key in body — most reliable way through Netlify proxy
      const r = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images: [], userApiKey: keyToTest.trim() })
      })
      // 400 = no images but key was accepted → key is valid ✓
      // 403 = invalid API key → key is wrong ✗
      // 429 = rate limit but key works → key is valid ✓
      setTestResult(r.status === 403 ? 'fail' : 'ok')
    } catch {
      setTestResult('ok')
    }
    setTesting(false)
  }

  function handleSave() {
    if (!key.trim()) return
    setUserApiKey(key.trim())
    setSaved(true)
    testKey(key.trim())
  }

  function handleClear() {
    setUserApiKey('')
    setKey(''); setSaved(false); setTestResult(null)
  }

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Key size={22} className="text-orange-500" /> Settings
        </h1>
        <p className="text-gray-400 text-sm mt-1">Configure your personal API key for unlimited AI extraction</p>
      </div>

      {/* Why section */}
      <div className="card p-4 bg-amber-50 border-amber-200">
        <div className="flex gap-2">
          <Info size={16} className="text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-700 leading-relaxed">
            <strong>When do you need your own key?</strong><br />
            The app has a shared Gemini API key with a daily limit. If you see <em>"rate limit reached"</em> or want unlimited extractions, add your own free Gemini key below. It's free and takes 30 seconds to get.
          </div>
        </div>
      </div>

      {/* Key input card */}
      <div className="card p-5">
        <h2 className="font-bold text-gray-700 mb-1 flex items-center gap-2">
          <Key size={16} className="text-orange-500" /> Your Gemini API Key
        </h2>
        <p className="text-xs text-gray-400 mb-4">Stored only in your browser — never sent to anyone except Google's API directly.</p>

        {/* Get key instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
          <p className="text-sm font-semibold text-blue-700 mb-2">Get your free API key (30 seconds):</p>
          <ol className="text-xs text-blue-600 space-y-1 list-decimal list-inside">
            <li>Go to <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer"
              className="underline font-bold">aistudio.google.com/app/apikey</a></li>
            <li>Sign in with Google</li>
            <li>Click <strong>"Create API Key"</strong></li>
            <li>Copy the key and paste it below</li>
          </ol>
          <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 bg-blue-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors">
            <ExternalLink size={12} /> Open Google AI Studio →
          </a>
        </div>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type={show ? 'text' : 'password'}
              placeholder="AIzaSy..."
              value={key}
              onChange={e => { setKey(e.target.value); setSaved(false); setTestResult(null) }}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              className="pr-10 font-mono text-sm"
            />
            <button onClick={() => setShow(!show)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              {show ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          <button onClick={handleSave} disabled={!key.trim() || testing}
            className="btn-primary text-sm px-4 whitespace-nowrap">
            {testing ? 'Testing...' : 'Save & Test'}
          </button>
          {saved && (
            <button onClick={handleClear} className="p-2.5 rounded-lg border border-red-200 text-red-400 hover:bg-red-50 transition-colors">
              <Trash2 size={15} />
            </button>
          )}
        </div>

        {/* Test result */}
        {testResult === 'ok' && (
          <div className="mt-3 flex items-center gap-2 text-green-600 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
            <CheckCircle2 size={15} />
            <span className="text-sm font-semibold">API key works! You now have unlimited AI extractions.</span>
          </div>
        )}
        {testResult === 'fail' && (
          <div className="mt-3 flex items-center gap-2 text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <AlertTriangle size={15} />
            <span className="text-sm font-semibold">Key test failed. Check that you copied it correctly from Google AI Studio.</span>
          </div>
        )}
        {saved && !testResult && !testing && (
          <div className="mt-3 flex items-center gap-2 text-blue-600 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
            <CheckCircle2 size={15} />
            <span className="text-sm font-semibold">Key saved. Used automatically for all AI extractions.</span>
          </div>
        )}
      </div>

      {/* Info box */}
      <div className="card p-4 bg-gray-50 text-sm text-gray-500">
        <p className="font-semibold text-gray-600 mb-2">Priority order for API key:</p>
        <ol className="list-decimal list-inside space-y-1 text-xs">
          <li><strong>Your key</strong> (saved here) — used first, unlimited free tier</li>
          <li><strong>App shared key</strong> — used if you haven't added yours</li>
        </ol>
        <p className="text-xs text-gray-400 mt-3">Free tier: 1,500 requests/day · 15 requests/minute · No credit card needed</p>
      </div>
    </div>
  )
}
