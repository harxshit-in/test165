import React, { useState } from 'react'
import { Plus, Play, Trash2, Clock, Hash, Shuffle, Share2, Copy, Check } from 'lucide-react'
import { generateTest } from '../utils/testGenerator'
import { saveTest, deleteTest } from '../utils/storage'
import { shareTest } from '../firebase/shareTest'
import { useNavigate } from 'react-router-dom'

export default function TestGenerator({ bank, tests, onTestsChange }) {
  const [form, setForm] = useState({ name:'', questionCount:20, timeLimit:30, randomOrder:true })
  const [creating, setCreating] = useState(false)
  const [sharing, setSharing] = useState(null)
  const [copiedId, setCopiedId] = useState(null)
  const nav = useNavigate()

  async function handleCreate(e) {
    e.preventDefault()
    if (!form.name.trim()) return
    setCreating(true)
    try {
      const test = generateTest(bank, form)
      await saveTest(test)
      onTestsChange?.()
      setForm(p=>({...p, name:''}))
    } finally { setCreating(false) }
  }

  async function handleDelete(testId) {
    if (!confirm('Delete this test?')) return
    await deleteTest(testId); onTestsChange?.()
  }

  async function handleShare(test) {
    setSharing(test.testId)
    try {
      const shareId = await shareTest(test)
      const url = `${window.location.origin}/shared?id=${shareId}`
      await navigator.clipboard.writeText(url)
      alert(`Shareable link copied!\n\n${url}`)
    } catch(err) {
      alert(`Sharing failed: ${err.message}\n\nConfigure Firebase in .env`)
    } finally { setSharing(null) }
  }

  async function copyTestLink(testId) {
    await navigator.clipboard.writeText(`${window.location.origin}/test/${testId}`)
    setCopiedId(testId); setTimeout(()=>setCopiedId(null),2000)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="card p-5">
        <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Plus size={16} className="text-orange-500"/> Create New Test
        </h3>
        <form onSubmit={handleCreate} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1 font-semibold">Test Name</label>
              <input type="text" placeholder="e.g. SSC Practice Test 1" value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} required />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1 font-semibold">Questions ({Math.min(form.questionCount,bank.questions.length)}/{bank.questions.length} available)</label>
              <input type="number" min={1} max={bank.questions.length} value={form.questionCount} onChange={e=>setForm(p=>({...p,questionCount:parseInt(e.target.value)||1}))} />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1 font-semibold">Time Limit (minutes)</label>
              <input type="number" min={1} max={300} value={form.timeLimit} onChange={e=>setForm(p=>({...p,timeLimit:parseInt(e.target.value)||1}))} />
            </div>
            <div className="flex items-center gap-3 pt-5">
              <input type="checkbox" id="randomOrder" checked={form.randomOrder} onChange={e=>setForm(p=>({...p,randomOrder:e.target.checked}))} className="w-4 h-4 accent-orange-500" />
              <label htmlFor="randomOrder" className="text-sm text-gray-700 cursor-pointer font-medium">Shuffle questions randomly</label>
            </div>
          </div>
          <button type="submit" className="btn-primary w-full sm:w-auto self-start" disabled={creating}>
            {creating ? 'Creating...' : 'Create Test'}
          </button>
        </form>
      </div>

      <div className="flex flex-wrap gap-2">
        <span className="text-sm text-gray-500 self-center">Quick presets:</span>
        {[{label:'Quick (20Q/20min)',q:20,t:20},{label:'Standard (50Q/60min)',q:50,t:60},{label:'Full Mock (100Q/90min)',q:100,t:90}].map(p=>(
          <button key={p.label} onClick={()=>setForm(prev=>({...prev,questionCount:p.q,timeLimit:p.t,name:prev.name||p.label}))}
            className="text-xs px-3 py-1.5 rounded-full border border-gray-200 text-gray-500 hover:border-orange-400 hover:text-orange-500 transition-colors bg-white">
            {p.label}
          </button>
        ))}
      </div>

      {tests.length > 0 && (
        <div>
          <h3 className="font-semibold text-gray-600 text-sm uppercase tracking-wider mb-3">Created Tests ({tests.length})</h3>
          <div className="flex flex-col gap-3">
            {tests.map(test=>(
              <div key={test.testId} className="card p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-800 truncate">{test.name}</p>
                  <div className="flex gap-3 text-xs text-gray-400 mt-1">
                    <span className="flex items-center gap-1"><Hash size={11}/>{test.questionCount}Q</span>
                    <span className="flex items-center gap-1"><Clock size={11}/>{Math.round(test.timeLimit/60)}min</span>
                    {test.config?.randomOrder && <span className="flex items-center gap-1"><Shuffle size={11}/>Shuffled</span>}
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <button className="btn-primary text-sm py-2 flex items-center gap-1.5" onClick={()=>nav(`/test/${test.testId}`)}>
                    <Play size={14}/> Start
                  </button>
                  <button className="btn-secondary text-sm py-2 flex items-center gap-1.5" onClick={()=>copyTestLink(test.testId)}>
                    {copiedId===test.testId ? <Check size={14} className="text-green-500"/> : <Copy size={14}/>} Copy Link
                  </button>
                  <button className="btn-secondary text-sm py-2 flex items-center gap-1.5" onClick={()=>handleShare(test)} disabled={sharing===test.testId}>
                    <Share2 size={14} className="text-blue-500"/> {sharing===test.testId ? 'Sharing...' : 'Share'}
                  </button>
                  <button className="btn-danger text-sm py-2 px-3" onClick={()=>handleDelete(test.testId)}><Trash2 size={14}/></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {tests.length===0 && <div className="text-center py-8 text-gray-400 text-sm">No tests yet. Create one above.</div>}
    </div>
  )
}
