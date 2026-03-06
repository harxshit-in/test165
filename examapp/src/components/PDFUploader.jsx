import React, { useState, useRef } from 'react'
import { AlertCircle, CheckCircle2, FileImage, Key, ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { renderPDFToImages } from '../utils/pdfReader'
import { extractFromImages } from '../utils/aiExtractor'
import { generateBankId } from '../utils/parser'
import { saveBank } from '../utils/storage'

export default function PDFUploader({ onBankCreated }) {
  const [phase, setPhase]     = useState('idle')
  const [progress, setProgress] = useState(0)
  const [msg, setMsg]         = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [stats, setStats]     = useState(null)
  const [rateLimited, setRateLimited] = useState(false)
  const inputRef = useRef()

  function hasKey() {
    try { return !!localStorage.getItem('user_gemini_api_key') } catch { return false }
  }

  async function handleFile(file) {
    if (!file?.name?.toLowerCase().endsWith('.pdf')) {
      setMsg('Please upload a PDF file.'); setPhase('error'); return
    }
    setPhase('render'); setProgress(3); setMsg('Opening PDF...')
    setStats(null); setRateLimited(false)

    try {
      // Step 1 — render pages to images
      const images = await renderPDFToImages(file, (pct, pageNum, total) => {
        setProgress(3 + pct * 0.2)
        setMsg(`Rendering page ${pageNum} of ${total}...`)
      })
      if (!images.length) throw new Error('Could not render PDF pages.')

      // Step 2 — send to AI
      setPhase('extract'); setProgress(25)
      setMsg(`Sending ${images.length} pages to Gemini AI...`)

      const questions = await extractFromImages(images, (pct, m) => {
        setProgress(25 + pct * 0.7)
        setMsg(m)
      })

      if (!questions.length) {
        setPhase('error')
        setMsg('No English MCQ questions found. Make sure the PDF has numbered questions with (a)(b)(c)(d) options.')
        return
      }

      // Step 3 — save
      setProgress(97); setMsg('Saving...')
      const bankId = generateBankId(file.name)
      const bank = {
        bankId, name: file.name.replace(/\.pdf$/i, ''),
        source: file.name, questions, createdAt: Date.now(), extractedWith: 'gemini-vision',
      }
      await saveBank(bank)
      setProgress(100); setPhase('done')
      setStats({ count: questions.length, withAnswers: questions.filter(q => q.correct !== null).length, pages: images.length })
      onBankCreated?.(bank)

    } catch (err) {
      console.error(err)
      setRateLimited(!!err.rateLimited)
      setMsg(err.message || 'Something went wrong.')
      setPhase('error')
    }
  }

  function reset() { setPhase('idle'); setProgress(0); setMsg(''); setStats(null); setRateLimited(false) }

  const barColor = phase === 'render' ? '#f97316' : phase === 'extract' ? '#8b5cf6' : '#22c55e'

  return (
    <div className="flex flex-col gap-4">

      {/* Key status */}
      <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm border ${hasKey() ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${hasKey() ? 'bg-green-500' : 'bg-amber-400'}`} />
        <span className={hasKey() ? 'text-green-700 font-semibold' : 'text-amber-700'}>
          {hasKey() ? 'Your Gemini key active — unlimited extractions' : '⚠️ Using shared key — add your own for reliability'}
        </span>
        <Link to="/settings" className="ml-auto text-xs font-semibold text-orange-500 flex items-center gap-1 hover:underline">
          <Key size={11} /> {hasKey() ? 'Change' : 'Add free key'}
        </Link>
      </div>

      {/* Drop zone */}
      <div
        className={`upload-zone ${dragOver ? 'drag-over' : ''} ${phase === 'idle' ? 'cursor-pointer' : 'cursor-default'}`}
        onClick={() => phase === 'idle' && inputRef.current?.click()}
        onDragOver={e => { if (phase === 'idle') { e.preventDefault(); setDragOver(true) } }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); if (phase === 'idle') handleFile(e.dataTransfer.files[0]) }}>
        <input ref={inputRef} type="file" accept=".pdf" className="hidden" onChange={e => handleFile(e.target.files[0])} />

        {phase === 'idle' && (
          <div className="flex flex-col items-center gap-3">
            <div className="w-16 h-16 rounded-2xl bg-purple-50 border-2 border-purple-200 flex items-center justify-center">
              <FileImage size={30} className="text-purple-500" />
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-gray-700">Drop your PDF here</p>
              <p className="text-gray-400 text-sm mt-1">Scanned · Bilingual Hindi+English · Any layout</p>
            </div>
            <div className="flex flex-wrap gap-1.5 justify-center">
              {['SSC','UPSC','Railway','Banking','NEET','JEE','PW / Aditya Ranjan'].map(t => (
                <span key={t} className="text-xs bg-gray-100 text-gray-500 px-2.5 py-0.5 rounded-full">{t}</span>
              ))}
            </div>
            <p className="text-xs text-gray-300">or click to browse</p>
          </div>
        )}

        {(phase === 'render' || phase === 'extract') && (
          <div className="flex flex-col items-center gap-4 w-full max-w-sm mx-auto" onClick={e => e.stopPropagation()}>
            <div className="flex gap-2 w-full text-xs font-bold">
              <div className={`flex-1 text-center py-2 rounded-lg border ${phase === 'render' ? 'bg-orange-100 border-orange-300 text-orange-700' : 'bg-green-100 border-green-300 text-green-700'}`}>
                {phase === 'render' ? '🖼️ Rendering...' : '✓ Rendered'}
              </div>
              <div className={`flex-1 text-center py-2 rounded-lg border ${phase === 'extract' ? 'bg-purple-100 border-purple-300 text-purple-700' : 'bg-gray-50 border-gray-200 text-gray-400'}`}>
                🧠 {phase === 'extract' ? 'AI Reading...' : 'AI Reading'}
              </div>
            </div>
            <p className="text-gray-700 font-semibold text-sm text-center">{msg}</p>
            <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${progress}%`, backgroundColor: barColor }} />
            </div>
            <p className="font-mono font-bold text-gray-500">{Math.round(progress)}%</p>
            {phase === 'extract' && (
              <p className="text-xs text-purple-500 text-center">All pages sent in one batch — faster & no rate limits</p>
            )}
          </div>
        )}

        {phase === 'done' && (
          <div className="flex flex-col items-center gap-4" onClick={e => e.stopPropagation()}>
            <div className="w-16 h-16 rounded-2xl bg-green-50 border-2 border-green-400 flex items-center justify-center">
              <CheckCircle2 size={32} className="text-green-500" />
            </div>
            <div className="text-center">
              <p className="text-3xl font-black text-green-600">{stats?.count}</p>
              <p className="text-green-600 font-bold">Questions Extracted!</p>
              {stats?.withAnswers > 0 && <p className="text-sm text-blue-500 mt-1">{stats.withAnswers} answers auto-detected</p>}
              <p className="text-xs text-gray-400 mt-1">from {stats?.pages} pages · English only</p>
            </div>
            <button className="btn-secondary text-sm" onClick={e => { e.stopPropagation(); reset() }}>Upload Another</button>
          </div>
        )}

        {phase === 'error' && (
          <div className="flex flex-col items-center gap-3" onClick={e => e.stopPropagation()}>
            <div className="w-16 h-16 rounded-2xl bg-red-50 border-2 border-red-300 flex items-center justify-center">
              <AlertCircle size={28} className="text-red-500" />
            </div>
            <p className="text-red-500 font-semibold text-center max-w-sm text-sm leading-relaxed">{msg}</p>
            {rateLimited && (
              <Link to="/settings" onClick={e => e.stopPropagation()}
                className="flex items-center gap-2 bg-orange-500 text-white text-sm font-bold px-5 py-2.5 rounded-xl hover:bg-orange-600 transition-colors">
                <Key size={15}/> Add Free Gemini Key <ArrowRight size={14}/>
              </Link>
            )}
            <button className="btn-secondary text-sm" onClick={e => { e.stopPropagation(); reset() }}>Try Again</button>
          </div>
        )}
      </div>

      <p className="text-xs text-center text-gray-400">🖼️ PDF → Images → 🧠 Gemini Vision · English MCQs only</p>
    </div>
  )
}
