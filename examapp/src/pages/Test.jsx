import React, { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getTest, saveProgress, getProgress, clearProgress, saveResult } from '../utils/storage'
import { calculateResult } from '../utils/testGenerator'
import Timer from '../components/Timer'
import NavigationGrid from '../components/NavigationGrid'
import { BookmarkPlus, ChevronLeft, ChevronRight, RotateCcw, Send, AlertTriangle, Menu, X } from 'lucide-react'

export default function TestPage() {
  const { testId } = useParams()
  const nav = useNavigate()
  const [test, setTest] = useState(null)
  const [answers, setAnswers] = useState({})
  const [markedForReview, setMarkedForReview] = useState(new Set())
  const [currentIndex, setCurrentIndex] = useState(0)
  const [timeLeft, setTimeLeft] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showConfirm, setShowConfirm] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const saveTimer = useRef()

  useEffect(()=>{
    async function load() {
      const t = await getTest(testId)
      if (!t) { nav('/'); return }
      const prog = await getProgress(testId)
      setTest(t)
      if (prog) {
        setAnswers(prog.answers||{}); setMarkedForReview(new Set(prog.markedForReview||[]))
        setCurrentIndex(prog.currentIndex||0); setTimeLeft(prog.timeLeft??t.timeLimit)
      } else { setTimeLeft(t.timeLimit) }
      setLoading(false)
    }
    load()
  },[testId])

  const persistProgress = useCallback(async(ans,marks,idx,tLeft)=>{
    await saveProgress(testId,{answers:ans,markedForReview:Array.from(marks),currentIndex:idx,timeLeft:tLeft})
  },[testId])

  function handleTimerTick(newTime) {
    setTimeLeft(newTime)
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(()=>persistProgress(answers,markedForReview,currentIndex,newTime),3000)
  }

  async function handleSubmit() {
    const result = calculateResult(test,answers)
    await saveResult(testId,{...result,testName:test.name})
    await clearProgress(testId)
    nav(`/result/${testId}`)
  }

  function selectAnswer(qId,optIdx) {
    setAnswers(p=>{const u={...p,[qId]:optIdx};persistProgress(u,markedForReview,currentIndex,timeLeft);return u})
  }
  function clearAnswer(qId) {
    setAnswers(p=>{const{[qId]:_,...rest}=p;persistProgress(rest,markedForReview,currentIndex,timeLeft);return rest})
  }
  function toggleMark(qId) {
    setMarkedForReview(p=>{const n=new Set(p);n.has(qId)?n.delete(qId):n.add(qId);persistProgress(answers,n,currentIndex,timeLeft);return n})
  }
  function goTo(idx) {
    setCurrentIndex(idx); persistProgress(answers,markedForReview,idx,timeLeft); setSidebarOpen(false)
  }

  if (loading) return <div className="flex items-center justify-center h-screen bg-gray-50"><div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"/></div>

  const q = test.questions[currentIndex]
  const selectedAnswer = answers[q.id]??null
  const isMarked = markedForReview.has(q.id)
  const answeredCount = Object.keys(answers).length
  const totalQ = test.questions.length

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-40">
        <div className="flex items-center justify-between px-4 h-14 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button className="lg:hidden p-1.5 text-gray-500" onClick={()=>setSidebarOpen(!sidebarOpen)}>
              {sidebarOpen?<X size={20}/>:<Menu size={20}/>}
            </button>
            <h1 className="font-bold text-gray-800 truncate text-sm sm:text-base">{test.name}</h1>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <span className="text-xs text-gray-400 hidden sm:block">{answeredCount}/{totalQ} answered</span>
            {timeLeft!==null && <Timer secondsLeft={timeLeft} onTick={handleTimerTick} onExpire={handleSubmit}/>}
            <button className="btn-primary text-sm py-2 px-3 sm:px-5 flex items-center gap-1.5" onClick={()=>setShowConfirm(true)}>
              <Send size={14}/><span className="hidden sm:inline">Submit</span>
            </button>
          </div>
        </div>
        <div className="progress-bar h-1">
          <div className="progress-fill" style={{width:`${(answeredCount/totalQ)*100}%`}}/>
        </div>
      </div>

      <div className="flex flex-1 max-w-7xl mx-auto w-full">
        {/* Sidebar */}
        <aside className={`lg:block lg:w-64 lg:sticky lg:top-14 lg:h-[calc(100vh-56px)] lg:overflow-y-auto
          fixed inset-y-14 left-0 z-30 w-72 overflow-y-auto bg-white border-r border-gray-200 p-3
          transition-transform lg:transition-none ${sidebarOpen?'translate-x-0':'-translate-x-full lg:translate-x-0'}`}>
          <NavigationGrid questions={test.questions} answers={answers} markedForReview={markedForReview} currentIndex={currentIndex} onJump={goTo}/>
        </aside>
        {sidebarOpen && <div className="fixed inset-0 bg-black/30 z-20 lg:hidden" onClick={()=>setSidebarOpen(false)}/>}

        {/* Main */}
        <main className="flex-1 flex flex-col">
          <div className="flex-1 p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="bg-orange-500 text-white font-bold px-3 py-1 rounded-lg text-sm">Q.{currentIndex+1}</span>
                <span className="text-gray-400 text-sm">of {totalQ}</span>
                {isMarked && <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-semibold">Marked</span>}
              </div>
              <span className="text-xs text-gray-400">General</span>
            </div>
            <div className="bg-white border-2 border-gray-200 rounded-xl p-5 mb-5 shadow-sm">
              <p className="text-gray-800 text-lg leading-relaxed font-medium">{q.question}</p>
            </div>
            <div className="flex flex-col gap-3">
              {q.options.map((opt,i)=>{
                const letter=['A','B','C','D','E'][i]
                return (
                  <button key={i} onClick={()=>selectedAnswer===i?clearAnswer(q.id):selectAnswer(q.id,i)}
                    className={`option-btn ${selectedAnswer===i?'selected':''}`}>
                    <span className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold shrink-0 border-2
                      ${selectedAnswer===i?'bg-blue-500 border-blue-500 text-white':'border-gray-300 text-gray-500'}`}>{letter}</span>
                    <span className="flex-1">{opt}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Bottom nav */}
          <div className="border-t border-gray-200 p-4 flex flex-wrap items-center justify-between gap-3 bg-white">
            <div className="flex gap-2">
              <button className="btn-secondary text-sm py-2 flex items-center gap-1" onClick={()=>goTo(Math.max(0,currentIndex-1))} disabled={currentIndex===0}>
                <ChevronLeft size={15}/> Prev
              </button>
              <button className="btn-secondary text-sm py-2 flex items-center gap-1" onClick={()=>goTo(Math.min(totalQ-1,currentIndex+1))} disabled={currentIndex===totalQ-1}>
                Next <ChevronRight size={15}/>
              </button>
            </div>
            <div className="flex gap-2">
              <button className={`text-sm py-2 px-3 rounded-lg font-semibold border transition-all flex items-center gap-1.5
                ${isMarked?'bg-purple-100 border-purple-400 text-purple-700':'border-gray-200 text-gray-500 hover:border-purple-400 hover:text-purple-600 bg-white'}`}
                onClick={()=>toggleMark(q.id)}>
                <BookmarkPlus size={14}/>{isMarked?'Unmark':'Mark Review'}
              </button>
              <button className="btn-secondary text-sm py-2 flex items-center gap-1.5 text-red-500 hover:bg-red-50"
                onClick={()=>clearAnswer(q.id)} disabled={selectedAnswer===null}>
                <RotateCcw size={13}/> Clear
              </button>
            </div>
            {currentIndex<totalQ-1 && (
              <button className="btn-primary text-sm py-2 flex items-center gap-1" onClick={()=>goTo(currentIndex+1)}>
                Save & Next <ChevronRight size={15}/>
              </button>
            )}
          </div>
        </main>
      </div>

      {/* Submit modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl animate-fade-in border border-gray-200">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle size={24} className="text-yellow-500 shrink-0"/>
              <h3 className="font-bold text-gray-800 text-lg">Submit Test?</h3>
            </div>
            <div className="grid grid-cols-3 gap-3 mb-5 text-center">
              <div className="bg-green-50 rounded-xl p-3 border border-green-200">
                <p className="text-2xl font-bold text-green-600">{answeredCount}</p>
                <p className="text-xs text-gray-500">Answered</p>
              </div>
              <div className="bg-red-50 rounded-xl p-3 border border-red-200">
                <p className="text-2xl font-bold text-red-500">{totalQ-answeredCount}</p>
                <p className="text-xs text-gray-500">Skipped</p>
              </div>
              <div className="bg-purple-50 rounded-xl p-3 border border-purple-200">
                <p className="text-2xl font-bold text-purple-600">{markedForReview.size}</p>
                <p className="text-xs text-gray-500">Marked</p>
              </div>
            </div>
            <p className="text-gray-400 text-sm mb-5">Once submitted you cannot change your answers.</p>
            <div className="flex gap-3">
              <button className="btn-secondary flex-1" onClick={()=>setShowConfirm(false)}>Go Back</button>
              <button className="btn-primary flex-1" onClick={handleSubmit}>Submit Now</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
