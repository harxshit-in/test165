import React, { useState, useRef } from 'react'
import { AlertCircle, CheckCircle2, FileImage, Key, ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { renderPDFToImages } from '../utils/pdfReader'
import { extractFromPDF, extractFromImages } from '../utils/aiExtractor'
import { generateBankId } from '../utils/parser'
import { saveBank } from '../utils/storage'

export default function PDFUploader({ onBankCreated }) {
  const [phase, setPhase]       = useState('idle')
  const [progress, setProgress] = useState(0)
  const [msg, setMsg]           = useState('')
  const [subMsg, setSubMsg]     = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [stats, setStats]       = useState(null)
  const [rateLimited, setRateLimited] = useState(false)
  const inputRef = useRef()

  function hasKey() { try { return !!localStorage.getItem('user_gemini_api_key') } catch { return false } }

  async function handleFile(file) {
    if (!file?.name?.toLowerCase().endsWith('.pdf')) {
      setMsg('Please upload a PDF file.'); setPhase('error'); return
    }

    setPhase('loading'); setProgress(3)
    setMsg('Starting...'); setSubMsg('')
    setStats(null); setRateLimited(false)

    try {
      let questions = []
      let mode = ''

      // ── ATTEMPT 1: Gemini File API (best — like NotebookLM) ──────────
      // Send raw PDF bytes directly — no rendering, 1 API call, handles all fonts
      setMsg('📄 Sending PDF to Gemini AI...')
      setSubMsg('File API mode — fastest & most accurate')
      setProgress(10)

      try {
        questions = await extractFromPDF(file, (p, m) => {
          setProgress(10 + p * 0.7)
          setMsg(m)
        })
        mode = 'Gemini File API'
      } catch (e1) {
        if (e1.rateLimited || e1.keyError) throw e1

        // ── ATTEMPT 2: Page images fallback ──────────────────────────
        console.warn('File API failed, trying image mode:', e1.message)
        setMsg('🖼️ Rendering pages as images...')
        setSubMsg('Fallback mode')
        setProgress(30)

        const images = await renderPDFToImages(file, (pct, pageNum, total) => {
          setProgress(30 + pct * 0.2)
          setMsg(`Rendering page ${pageNum} of ${total}...`)
        })

        setMsg('🧠 AI reading page images...')
        setProgress(52)

        questions = await extractFromImages(images, (p, m) => {
          setProgress(52 + p * 0.4)
          setMsg(m)
        })
        mode = 'Vision (image fallback)'
      }

      if (!questions.length) {
        setPhase('error')
        setMsg('No English MCQ questions found. Make sure the PDF has numbered questions with (a)(b)(c)(d) options.')
        setSubMsg('')
        return
      }

      // Save
      setProgress(96); setMsg('Saving question bank...')
      const bankId = generateBankId(file.name)
      await saveBank({
        bankId,
        name:          file.name.replace(/\.pdf$/i, ''),
        source:        file.name,
        questions,
        createdAt:     Date.now(),
        extractedWith: mode,
      })

      setProgress(100)
      setPhase('done')
      setStats({ count: questions.length, withAnswers: questions.filter(q => q.correct !== null).length, mode })
      onBankCreated?.({ bankId, name: file.name.replace(/\.pdf$/i,''), questions })

    } catch (err) {
      console.error(err)
      setRateLimited(!!err.rateLimited)
      setMsg(err.message || 'Something went wrong.')
      setSubMsg('')
      setPhase('error')
    }
  }

  function reset() {
    setPhase('idle'); setProgress(0)
    setMsg(''); setSubMsg('')
    setStats(null); setRateLimited(false)
  }

  const hasUserKey = hasKey()

  return (
    <div className="flex flex-col gap-4">

      {/* Key status */}
      <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm border
        ${hasUserKey ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${hasUserKey ? 'bg-green-500' : 'bg-amber-400'}`} />
        <span className={hasUserKey ? 'text-green-700 font-semibold' : 'text-amber-700 font-medium'}>
          {hasUserKey ? '✓ Your Gemini key active — unlimited extractions' : '⚠️ Using shared key — add your own for best results'}
        </span>
        <Link to="/settings" className="ml-auto text-xs font-bold text-orange-500 flex items-center gap-1 hover:underline shrink-0">
          <Key size={11}/> {hasUserKey ? 'Change' : 'Add free key →'}
        </Link>
      </div>

      {/* How it works */}
      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        {[
          { icon: '📄', title: 'File API',    sub: 'Like NotebookLM' },
          { icon: '🧠', title: 'Gemini 2.0',  sub: 'Reads natively'  },
          { icon: '✅', title: 'English Only', sub: 'Skips Hindi'     },
        ].map(({ icon, title, sub }) => (
          <div key={title} className="bg-gray-50 border border-gray-200 rounded-xl p-2.5">
            <div className="text-xl mb-0.5">{icon}</div>
            <div className="font-bold text-gray-700">{title}</div>
            <div className="text-gray-400">{sub}</div>
          </div>
        ))}
      </div>

      {/* Drop zone */}
      <div
        className={`upload-zone ${dragOver ? 'drag-over' : ''} ${phase === 'idle' ? 'cursor-pointer' : 'cursor-default'}`}
        onClick={() => phase === 'idle' && inputRef.current?.click()}
        onDragOver={e => { if (phase==='idle'){e.preventDefault();setDragOver(true)} }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault();setDragOver(false);if(phase==='idle')handleFile(e.dataTransfer.files[0]) }}>
        <input ref={inputRef} type="file" accept=".pdf" className="hidden" onChange={e => handleFile(e.target.files[0])} />

        {/* IDLE */}
        {phase === 'idle' && (
          <div className="flex flex-col items-center gap-3">
            <div className="w-16 h-16 rounded-2xl bg-purple-50 border-2 border-purple-200 flex items-center justify-center">
              <FileImage size={30} className="text-purple-500" />
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-gray-700">Drop your PDF here</p>
              <p className="text-gray-400 text-sm mt-1">Any format · Hindi+English · Scanned · Any layout</p>
            </div>
            <div className="flex flex-wrap gap-1.5 justify-center">
              {['SSC','UPSC','Railway','Banking','NEET','JEE','PW','Aditya Ranjan'].map(t=>(
                <span key={t} className="text-xs bg-gray-100 text-gray-500 px-2.5 py-0.5 rounded-full">{t}</span>
              ))}
            </div>
            <p className="text-xs text-gray-300">or click to browse</p>
          </div>
        )}

        {/* LOADING */}
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

        {/* DONE */}
        {phase === 'done' && (
          <div className="flex flex-col items-center gap-4" onClick={e=>e.stopPropagation()}>
            <div className="w-16 h-16 rounded-2xl bg-green-50 border-2 border-green-400 flex items-center justify-center">
              <CheckCircle2 size={32} className="text-green-500"/>
            </div>
            <div className="text-center">
              <p className="text-3xl font-black text-green-600">{stats?.count}</p>
              <p className="font-bold text-green-600">Questions Extracted!</p>
              {stats?.withAnswers > 0 && <p className="text-sm text-blue-500 mt-1">{stats.withAnswers} answers auto-detected</p>}
              <p className="text-xs text-gray-400 mt-1">via {stats?.mode}</p>
            </div>
            <button className="btn-secondary text-sm" onClick={e=>{e.stopPropagation();reset()}}>Upload Another</button>
          </div>
        )}

        {/* ERROR */}
        {phase === 'error' && (
          <div className="flex flex-col items-center gap-3" onClick={e=>e.stopPropagation()}>
            <div className="w-16 h-16 rounded-2xl bg-red-50 border-2 border-red-300 flex items-center justify-center">
              <AlertCircle size={28} className="text-red-500"/>
            </div>
            <p className="text-red-500 font-semibold text-center max-w-sm text-sm leading-relaxed">{msg}</p>
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
        📄 Gemini File API · Like NotebookLM · English MCQs only · Free
      </p>
    </div>
  )
}
