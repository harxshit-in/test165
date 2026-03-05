import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getResult, getTest } from '../utils/storage'
import { Award, CheckCircle2, XCircle, MinusCircle, RotateCcw, Home, ChevronDown, ChevronUp } from 'lucide-react'

export default function ResultPage() {
  const { testId } = useParams()
  const [result, setResult] = useState(null)
  const [test, setTest] = useState(null)
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState(null)
  const [filter, setFilter] = useState('all')

  useEffect(()=>{
    async function load() {
      const [r,t] = await Promise.all([getResult(testId),getTest(testId)])
      setResult(r); setTest(t); setLoading(false)
    }
    load()
  },[testId])

  if (loading) return <div className="flex items-center justify-center h-screen bg-gray-50"><div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"/></div>
  if (!result) return <div className="flex flex-col items-center justify-center h-screen bg-gray-50 gap-4 text-gray-400"><p>Result not found.</p><Link to="/" className="btn-primary">Go Home</Link></div>

  const { correct, incorrect, skipped, total, percentage, details } = result
  const grade = percentage>=90?'A+':percentage>=75?'A':percentage>=60?'B':percentage>=40?'C':'D'
  const gradeColor = percentage>=75?'text-green-600':percentage>=40?'text-yellow-600':'text-red-500'
  const gradeBg = percentage>=75?'from-green-50 to-emerald-50':percentage>=40?'from-yellow-50 to-orange-50':'from-red-50 to-pink-50'
  const filteredDetails = filter==='all'?details:details?.filter(d=>d.status===filter)??[]

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="max-w-4xl mx-auto flex flex-col gap-6 animate-fade-in">
        <div className={`card p-6 text-center bg-gradient-to-br ${gradeBg}`}>
          <div className={`text-7xl font-display tracking-wider mb-1 ${gradeColor}`}>{grade}</div>
          <div className="text-5xl font-bold text-gray-800 mb-1">{percentage}%</div>
          <p className="text-gray-500 text-lg">{result.testName||testId}</p>
          <div className="grid grid-cols-3 gap-4 mt-6">
            <div className="bg-green-100 rounded-xl p-4 border border-green-200">
              <CheckCircle2 size={22} className="text-green-600 mx-auto mb-1"/>
              <p className="text-3xl font-bold text-green-700">{correct}</p>
              <p className="text-xs text-gray-500">Correct</p>
            </div>
            <div className="bg-red-100 rounded-xl p-4 border border-red-200">
              <XCircle size={22} className="text-red-500 mx-auto mb-1"/>
              <p className="text-3xl font-bold text-red-600">{incorrect}</p>
              <p className="text-xs text-gray-500">Incorrect</p>
            </div>
            <div className="bg-gray-100 rounded-xl p-4 border border-gray-200">
              <MinusCircle size={22} className="text-gray-500 mx-auto mb-1"/>
              <p className="text-3xl font-bold text-gray-600">{skipped}</p>
              <p className="text-xs text-gray-500">Skipped</p>
            </div>
          </div>
          <div className="mt-5">
            <div className="progress-bar h-3 rounded-full">
              <div className="progress-fill h-full rounded-full" style={{width:`${percentage}%`,background:percentage>=75?'#22c55e':percentage>=40?'#eab308':'#ef4444'}}/>
            </div>
            <div className="flex justify-between text-xs text-gray-400 mt-1"><span>0</span><span>Score: {correct}/{total}</span><span>{total}</span></div>
          </div>
        </div>

        <div className="flex gap-3 flex-wrap">
          <Link to="/" className="btn-secondary flex items-center gap-2"><Home size={15}/> Dashboard</Link>
          {test && <Link to={`/test/${testId}`} className="btn-primary flex items-center gap-2"><RotateCcw size={15}/> Retake</Link>}
        </div>

        {details && (
          <div>
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <h2 className="font-bold text-gray-700 text-lg">Review Answers</h2>
              <div className="flex gap-1 flex-wrap">
                {[['all',`All (${total})`],['correct',`Correct (${correct})`],['incorrect',`Wrong (${incorrect})`],['skipped',`Skipped (${skipped})`]].map(([f,label])=>(
                  <button key={f} onClick={()=>setFilter(f)}
                    className={`text-xs px-3 py-1.5 rounded-full border font-semibold transition-colors
                      ${filter===f?'bg-orange-500 border-orange-500 text-white':'border-gray-200 text-gray-500 hover:border-orange-300 bg-white'}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              {filteredDetails.map(d=>{
                const isExpanded = expandedId===d.id
                const borderColor = d.status==='correct'?'border-l-green-500':d.status==='incorrect'?'border-l-red-400':'border-l-gray-300'
                const statusIcon = d.status==='correct'?<CheckCircle2 size={16} className="text-green-500 shrink-0"/>:
                  d.status==='incorrect'?<XCircle size={16} className="text-red-400 shrink-0"/>:<MinusCircle size={16} className="text-gray-400 shrink-0"/>
                return (
                  <div key={d.id} className={`card border-l-4 ${borderColor} overflow-hidden`}>
                    <div className="flex items-start gap-3 p-4 cursor-pointer hover:bg-gray-50 transition-colors" onClick={()=>setExpandedId(isExpanded?null:d.id)}>
                      {statusIcon}
                      <div className="flex-1 min-w-0">
                        <span className="bg-orange-100 text-orange-600 font-mono text-xs px-1.5 py-0.5 rounded mr-2">Q.{details.indexOf(d)+1}</span>
                        <span className="text-gray-700 text-sm">{d.question}</span>
                      </div>
                      {isExpanded?<ChevronUp size={14} className="text-gray-400 shrink-0"/>:<ChevronDown size={14} className="text-gray-400 shrink-0"/>}
                    </div>
                    {isExpanded && (
                      <div className="border-t border-gray-100 p-4 grid grid-cols-1 sm:grid-cols-2 gap-2 bg-gray-50">
                        {d.options.map((opt,i)=>{
                          const isSelected=d.selected===i, isCorrect=d.correct===i
                          return (
                            <div key={i} className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm border
                              ${isCorrect?'border-green-400 bg-green-50 text-green-800':isSelected&&!isCorrect?'border-red-400 bg-red-50 text-red-700':'border-gray-200 text-gray-500'}`}>
                              <span className="font-bold">{['A','B','C','D'][i]}.</span>
                              <span className="flex-1">{opt}</span>
                              {isCorrect && <CheckCircle2 size={14} className="text-green-500 shrink-0"/>}
                              {isSelected&&!isCorrect && <XCircle size={14} className="text-red-400 shrink-0"/>}
                            </div>
                          )
                        })}
                        {d.correct===null && <p className="col-span-2 text-xs text-gray-400 italic">Correct answer not set.</p>}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
