import React, { useState, useRef } from 'react'
import { AlertCircle, CheckCircle2, FileImage, Key, ArrowRight, Zap } from 'lucide-react'
import { Link } from 'react-router-dom'
import { renderPDFToImages } from '../utils/pdfReader'
import { extractFromPDF, extractFromImages } from '../utils/aiExtractor'
import { generateBankId } from '../utils/parser'
import { saveBank } from '../utils/storage'

export default function PDFUploader({ onBankCreated }) {
  const [phase, setPhase]           = useState('idle')
  const [progress, setProgress]     = useState(0)
  const [msg, setMsg]               = useState('')
  const [subMsg, setSubMsg]         = useState('')
  const [dragOver, setDragOver]     = useState(false)
  const [stats, setStats]           = useState(null)
  const [rateLimited, setRateLimited] = useState(false)
  const inputRef = useRef()

  function hasKey() { try { return !!localStorage.getItem('user_gemini_api_key') } catch { return false } }

  async function handleFile(file) {
    if (!file?.name?.toLowerCase().endsWith('.pdf')) {
      setMsg('Please upload a PDF file.'); setPhase('error'); return
    }
    setPhase('loading'); setProgress(3); setMsg('Starting...')
    setSubMsg(''); setStats(null); setRateLimited(false)

    const usingOwnKey = hasKey()

    try {
      let questions = []

      // ── PRIMARY: Gemini File API ──────────────────────────────────────
      setMsg('📄 Sending PDF to Gemini AI...')
      setSubMsg(usingOwnKey
        ? '⚡ Direct browser→Gemini (no timeout, your key)'
        : '🌐 Via server (shared key)')
      setProgress(10)

      try {
        questions = await extractFromPDF(file, (p, m) => {
          setProgress(10 + p * 0.75)
          setMsg(m)
        })
      } catch (e1) {
        if (e1.rateLimited || e1.keyError) throw e1

        // ── FALLBACK: Page images ─────────────────────────────────────
        console.warn('PDF mode failed, trying images:', e1.message)
        setMsg('🖼️ Rendering pages as images...')
        setSubMsg('Fallback mode')
        setProgress(30)

        const images = await renderPDFToImages(file, (pct, pn, total) => {
          setProgress(30 + pct * 0.2)
          setMsg(`Rendering page ${pn} of ${total}...`)
        })
        setProgress(52); setMsg('🧠 AI reading pages...')
        questions = await extractFromImages(images, (p, m) => {
          setProgress(52 + p * 0.4); setMsg(m)
        })
      }

      if (!questions.length) {
        setPhase('error')
        setMsg('No English MCQ questions found. Make sure the PDF has numbered questions with (a)(b)(c)(d) options.')
        setSubMsg(usingOwnKey ? '' : '💡 Tip: Add your own free Gemini key in Settings for better results')
        return
      }

      setProgress(96); setMsg('Saving...')
      const bankId = generateBankId(file.name)
      await saveBank({ bankId, name: file.name.replace(/\.pdf$/i,''), source: file.name, questions, createdAt: Date.now() })
      setProgress(100); setPhase('done')
      setStats({ count: questions.length, withAnswers: questions.filter(q => q.correct !== null).length })
      onBankCreated?.({ bankId, name: file.name.replace(/\.pdf$/i,''), questions })

    } catch (err) {
      console.error(err)
      setRateLimited(!!err.rateLimited)
      setMsg(err.message || 'Something went wrong.')
      setSubMsg('')
      setPhase('error')
    }
  }

  function reset() { setPhase('idle'); setProgress(0); setMsg(''); setSubMsg(''); setStats(null); setRateLimited(false) }

  return (
    <div className="flex flex-col gap-4">

      {/* Key status banner */}
      {hasKey() ? (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-green-50 border border-green-200 text-sm">
          <Zap size={15} className="text-green-600 shrink-0" />
          <div>
            <span className="font-bold text-green-700">Your key active — </span>
            <span className="text-green-600">Gemini called directly from browser, zero timeout risk</span>
          </div>
          <Link to="/settings" className="ml-auto text-xs text-green-600 underline shrink-0">Change</Link>
        </div>
      ) : (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-sm">
          <AlertCircle size={15} className="text-amber-600 shrink-0" />
          <div>
            <span className="font-bold text-amber-700">Using shared key — </span>
            <span className="text-amber-600">may hit rate limits. Add your own free key for best results.</span>
          </div>
          <Link to="/settings" className="ml-auto text-xs font-bold text-orange-500 flex items-center gap-1 shrink-0">
            <Key size={11}/> Add free key →
          </Link>
        </div>
      )}

      {/* Drop zone */}
      <div
        className={`upload-zone ${dragOver ? 'drag-over' : ''} ${phase === 'idle' ? 'cursor-pointer' : 'cursor-default'}`}
        onClick={() => phase === 'idle' && inputRef.current?.click()}
        onDragOver={e => { if (phase==='idle'){e.preventDefault();setDragOver(true)} }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault();setDragOver(false);if(phase==='idle')handleFile(e.dataTransfer.files[0]) }}>
        <input ref={inputRef} type="file" accept=".pdf" className="hidden" onChange={e=>handleFile(e.target.files[0])} />

        {phase === 'idle' && (
          <div className="flex flex-col items-center gap-3">
            <div className="w-16 h-16 rounded-2xl bg-purple-50 border-2 border-purple-200 flex items-center justify-center">
              <FileImage size={30} className="text-purple-500" />
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-gray-700">Drop your PDF here</p>
              <p className="text-gray-400 text-sm mt-1">Hindi+English · Scanned · Any layout · Any encoding</p>
            </div>
            <div className="flex flex-wrap gap-1.5 justify-center">
              {['SSC','UPSC','Railway','Banking','NEET','JEE','PW','Aditya Ranjan'].map(t=>(
                <span key={t} className="text-xs bg-gray-100 text-gray-500 px-2.5 py-0.5 rounded-full">{t}</span>
              ))}
            </div>
            <p className="text-xs text-gray-300">or click to browse</p>
          </div>
        )}

        {phase === 'loading' && (
          <div className="flex flex-col items-center gap-4 w-full max-w-xs mx-auto" onClick={e=>e.stopPropagation()}>
            <div className="w-14 h-14 rounded-2xl bg-purple-50 border-2 border-purple-300 flex items-center justify-center">
              <FileImage size={26} className="text-purple-500 animate-pulse"/>
            </div>
            <div className="text-center">
              <p className="font-bold text-gray-700 text-sm">{msg}</p>
              {subMsg && <p className="text-xs text-purple-500 mt-1">{subMsg}</p>}
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500"
                style={{ width:`${progress}%`, background:'linear-gradient(90deg,#f97316,#8b5cf6,#3b82f6)' }}/>
            </div>
            <p className="font-mono font-bold text-gray-500 text-sm">{Math.round(progress)}%</p>
          </div>
        )}

        {phase === 'done' && (
          <div className="flex flex-col items-center gap-4" onClick={e=>e.stopPropagation()}>
            <div className="w-16 h-16 rounded-2xl bg-green-50 border-2 border-green-400 flex items-center justify-center">
              <CheckCircle2 size={32} className="text-green-500"/>
            </div>
            <div className="text-center">
              <p className="text-4xl font-black text-green-600">{stats?.count}</p>
              <p className="font-bold text-green-600 text-lg">Questions Extracted!</p>
              {stats?.withAnswers > 0 && <p className="text-sm text-blue-500 mt-1">{stats.withAnswers} correct answers auto-detected</p>}
            </div>
            <button className="btn-secondary text-sm" onClick={e=>{e.stopPropagation();reset()}}>Upload Another</button>
          </div>
        )}

        {phase === 'error' && (
          <div className="flex flex-col items-center gap-3" onClick={e=>e.stopPropagation()}>
            <div className="w-16 h-16 rounded-2xl bg-red-50 border-2 border-red-300 flex items-center justify-center">
              <AlertCircle size={28} className="text-red-500"/>
            </div>
            <p className="text-red-500 font-semibold text-center max-w-sm text-sm leading-relaxed">{msg}</p>
            {subMsg && <p className="text-amber-600 text-xs text-center mt-1">{subMsg}</p>}
            {rateLimited && (
              <Link to="/settings" onClick={e=>e.stopPropagation()}
                className="flex items-center gap-2 bg-orange-500 text-white text-sm font-bold px-5 py-2.5 rounded-xl hover:bg-orange-600">
                <Key size={15}/> Add Free Gemini Key <ArrowRight size={14}/>
              </Link>
            )}
            <button className="btn-secondary text-sm" onClick={e=>{e.stopPropagation();reset()}}>Try Again</button>
          </div>
        )}
      </div>

      <p className="text-xs text-center text-gray-400">
        📄 Gemini File API · {hasKey() ? '⚡ Direct browser call (no timeout)' : '🌐 Via server'} · English MCQs only
      </p>
    </div>
  )
}
