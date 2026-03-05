import React, { useState, useRef } from 'react'
import { AlertCircle, CheckCircle2, FileImage, Key, ArrowRight, Layers } from 'lucide-react'
import { Link } from 'react-router-dom'
import { renderPDFToImages } from '../utils/pdfReader'
import { extractFromImages } from '../utils/aiExtractor'
import { generateBankId } from '../utils/parser'
import { saveBank } from '../utils/storage'
import { getUserApiKey } from '../pages/Settings'

export default function PDFUploader({ onBankCreated }) {
  const [phase, setPhase]       = useState('idle')   // idle | render | extract | done | error
  const [progress, setProgress] = useState(0)
  const [msg, setMsg]           = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [stats, setStats]       = useState(null)
  const [rateLimited, setRateLimited] = useState(false)
  const [pagesDone, setPagesDone]     = useState(0)
  const [pagesTotal, setPagesTotal]   = useState(0)
  const inputRef = useRef()

  async function handleFile(file) {
    if (!file?.name?.toLowerCase().endsWith('.pdf')) {
      setMsg('Please upload a PDF file.'); setPhase('error'); return
    }

    setPhase('render'); setProgress(2); setMsg('Opening PDF...')
    setStats(null); setRateLimited(false); setPagesDone(0); setPagesTotal(0)

    try {
      // ── STEP 1: Render all PDF pages to images ──────────────────────
      const images = await renderPDFToImages(file, (pct, pageNum, total) => {
        setProgress(2 + pct * 0.25)
        setMsg(`Rendering page ${pageNum} of ${total} as image...`)
        setPagesTotal(total)
      })

      if (!images.length) throw new Error('Could not render PDF pages.')

      setPagesTotal(images.length)
      setProgress(28)
      setMsg(`Rendered ${images.length} pages — sending to Gemini AI...`)

      // ── STEP 2: Send each page image to Gemini Vision ───────────────
      setPhase('extract')
      const questions = await extractFromImages(images, (pct, m, done, total) => {
        setProgress(28 + pct * 0.68)
        setMsg(m)
        setPagesDone(done)
        setPagesTotal(total)
      })

      if (questions.length === 0) {
        setPhase('error')
        setMsg('No English MCQ questions found. Make sure the PDF contains numbered questions with (a)(b)(c)(d) options.')
        return
      }

      // ── STEP 3: Save ────────────────────────────────────────────────
      setProgress(97); setMsg('Saving question bank...')
      const bankId = generateBankId(file.name)
      const bank = {
        bankId,
        name:          file.name.replace(/\.pdf$/i, ''),
        source:        file.name,
        questions,
        createdAt:     Date.now(),
        extractedWith: 'gemini-vision',
      }
      await saveBank(bank)
      setProgress(100)
      setPhase('done')
      setStats({
        count:       questions.length,
        withAnswers: questions.filter(q => q.correct !== null).length,
        pages:       images.length,
      })
      onBankCreated?.(bank)

    } catch (err) {
      console.error(err)
      if (err.rateLimited) {
        setRateLimited(true)
        setMsg(err.message)
      } else {
        setMsg(`Error: ${err.message}`)
      }
      setPhase('error')
    }
  }

  function reset() {
    setPhase('idle'); setProgress(0); setMsg('')
    setStats(null); setRateLimited(false); setPagesDone(0); setPagesTotal(0)
  }

  const hasKey = !!getUserApiKey()

  // Progress bar color based on phase
  const barColor = phase === 'render'  ? '#f97316'   // orange
                 : phase === 'extract' ? '#8b5cf6'   // purple
                 : '#22c55e'                          // green

  return (
    <div className="flex flex-col gap-4">

      {/* API key status bar */}
      <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm border
        ${hasKey ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${hasKey ? 'bg-green-500' : 'bg-gray-400'}`} />
        <span className={hasKey ? 'text-green-700 font-semibold' : 'text-gray-500'}>
          {hasKey ? 'Your Gemini key active — unlimited extractions' : 'Using shared API key'}
        </span>
        <Link to="/settings" className={`ml-auto text-xs font-semibold flex items-center gap-1
          ${hasKey ? 'text-green-600' : 'text-orange-500'}`}>
          <Key size={11} /> {hasKey ? 'Change' : 'Add your key'}
        </Link>
      </div>

      {/* How it works */}
      <div className="grid grid-cols-3 gap-2 text-xs text-center">
        {[
          { icon: '📄', label: 'Upload PDF',      sub: 'Any format' },
          { icon: '🖼️', label: 'Pages → Images',  sub: 'Bypasses fonts' },
          { icon: '🧠', label: 'Gemini Reads',    sub: 'English only' },
        ].map(({ icon, label, sub }) => (
          <div key={label} className="bg-gray-50 border border-gray-200 rounded-xl p-2.5">
            <div className="text-xl mb-1">{icon}</div>
            <div className="font-bold text-gray-700">{label}</div>
            <div className="text-gray-400">{sub}</div>
          </div>
        ))}
      </div>

      {/* Drop zone */}
      <div
        className={`upload-zone ${dragOver ? 'drag-over' : ''} ${phase === 'idle' ? 'cursor-pointer' : 'cursor-default'}`}
        onClick={() => phase === 'idle' && inputRef.current?.click()}
        onDragOver={e => { if (phase === 'idle') { e.preventDefault(); setDragOver(true) } }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); if (phase === 'idle') handleFile(e.dataTransfer.files[0]) }}>
        <input ref={inputRef} type="file" accept=".pdf" className="hidden"
          onChange={e => handleFile(e.target.files[0])} />

        {/* IDLE */}
        {phase === 'idle' && (
          <div className="flex flex-col items-center gap-3">
            <div className="w-16 h-16 rounded-2xl bg-purple-50 border-2 border-purple-200 flex items-center justify-center">
              <FileImage size={30} className="text-purple-500" />
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-gray-700">Drop your PDF here</p>
              <p className="text-gray-400 text-sm mt-1">
                Scanned · Bilingual · Hindi+English · Any layout
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5 justify-center">
              {['SSC', 'UPSC', 'Railway', 'Banking', 'NEET', 'JEE', 'State PSC', 'PW / Aditya Ranjan'].map(t => (
                <span key={t} className="text-xs bg-gray-100 text-gray-500 px-2.5 py-0.5 rounded-full">{t}</span>
              ))}
            </div>
            <p className="text-xs text-gray-300">or click to browse</p>
          </div>
        )}

        {/* RENDERING / EXTRACTING */}
        {(phase === 'render' || phase === 'extract') && (
          <div className="flex flex-col items-center gap-4 w-full max-w-sm mx-auto" onClick={e => e.stopPropagation()}>

            {/* Phase indicator */}
            <div className="flex gap-2 w-full">
              <div className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold border transition-all
                ${phase === 'render' ? 'bg-orange-100 border-orange-300 text-orange-700' : 'bg-green-100 border-green-300 text-green-700'}`}>
                <Layers size={13} />
                {phase === 'render' ? 'Rendering Pages...' : '✓ Pages Rendered'}
              </div>
              <div className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold border transition-all
                ${phase === 'extract' ? 'bg-purple-100 border-purple-300 text-purple-700' : 'bg-gray-50 border-gray-200 text-gray-400'}`}>
                🧠 {phase === 'extract' ? `Reading (${pagesDone}/${pagesTotal})` : 'AI Reading'}
              </div>
            </div>

            <p className="text-gray-700 font-semibold text-sm text-center leading-snug">{msg}</p>

            {/* Progress bar */}
            <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden shadow-inner">
              <div className="h-full rounded-full transition-all duration-700 ease-out"
                style={{ width: `${progress}%`, backgroundColor: barColor }} />
            </div>

            <div className="flex items-center justify-between w-full text-xs text-gray-400">
              <span>{Math.round(progress)}%</span>
              {phase === 'extract' && pagesTotal > 0 && (
                <span>{pagesDone} / {pagesTotal} pages processed</span>
              )}
            </div>

            {phase === 'extract' && (
              <p className="text-xs text-purple-500 text-center">
                AI is reading each page visually — ignoring Hindi, extracting English MCQs
              </p>
            )}
          </div>
        )}

        {/* DONE */}
        {phase === 'done' && (
          <div className="flex flex-col items-center gap-4" onClick={e => e.stopPropagation()}>
            <div className="w-16 h-16 rounded-2xl bg-green-50 border-2 border-green-400 flex items-center justify-center">
              <CheckCircle2 size={32} className="text-green-500" />
            </div>
            <div className="text-center">
              <p className="text-3xl font-black text-green-600">{stats?.count}</p>
              <p className="text-green-600 font-bold">Questions Extracted!</p>
              {stats?.withAnswers > 0 && (
                <p className="text-sm text-blue-500 mt-1">{stats.withAnswers} correct answers auto-detected</p>
              )}
              <p className="text-xs text-gray-400 mt-1">from {stats?.pages} pages · Gemini Vision · English only</p>
            </div>
            <button className="btn-secondary text-sm" onClick={e => { e.stopPropagation(); reset() }}>
              Upload Another PDF
            </button>
          </div>
        )}

        {/* ERROR */}
        {phase === 'error' && (
          <div className="flex flex-col items-center gap-3" onClick={e => e.stopPropagation()}>
            <div className="w-16 h-16 rounded-2xl bg-red-50 border-2 border-red-300 flex items-center justify-center">
              <AlertCircle size={28} className="text-red-500" />
            </div>
            <p className="text-red-500 font-semibold text-center max-w-sm leading-snug text-sm">{msg}</p>
            {rateLimited && (
              <Link to="/settings" onClick={e => e.stopPropagation()}
                className="flex items-center gap-2 bg-orange-500 text-white text-sm font-bold px-5 py-2.5 rounded-xl hover:bg-orange-600 transition-colors">
                <Key size={15} /> Add Free Gemini Key <ArrowRight size={14} />
              </Link>
            )}
            <button className="btn-secondary text-sm" onClick={e => { e.stopPropagation(); reset() }}>
              Try Again
            </button>
          </div>
        )}
      </div>

      <p className="text-xs text-center text-gray-400">
        🖼️ PDF → Images → 🧠 Gemini Vision → English MCQs only · No Hindi · No garbled text
      </p>
    </div>
  )
}
