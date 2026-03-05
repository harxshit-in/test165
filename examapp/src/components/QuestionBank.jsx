import React, { useState, useMemo } from 'react'
import { Search, Edit2, Trash2, Check, X, ChevronDown, ChevronUp } from 'lucide-react'
import { updateBankQuestions } from '../utils/storage'

export default function QuestionBank({ bank, onUpdate }) {
  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editData, setEditData] = useState({})
  const [expandedId, setExpandedId] = useState(null)

  const filtered = useMemo(() => {
    if (!search.trim()) return bank.questions
    const q = search.toLowerCase()
    return bank.questions.filter(qu =>
      qu.question.toLowerCase().includes(q) || qu.options.some(o => o.toLowerCase().includes(q))
    )
  }, [bank.questions, search])

  function startEdit(q) {
    setEditingId(q.id)
    setEditData({ question: q.question, options: [...q.options], correct: q.correct })
  }

  async function saveEdit(id) {
    const updated = bank.questions.map(q => q.id === id ? { ...q, ...editData } : q)
    await updateBankQuestions(bank.bankId, updated)
    onUpdate?.({ ...bank, questions: updated })
    setEditingId(null)
  }

  async function deleteQuestion(id) {
    if (!confirm('Delete this question?')) return
    const updated = bank.questions.filter(q => q.id !== id)
    await updateBankQuestions(bank.bankId, updated)
    onUpdate?.({ ...bank, questions: updated })
  }

  async function setCorrectAnswer(qId, optIdx) {
    const updated = bank.questions.map(q => q.id === qId ? { ...q, correct: optIdx } : q)
    await updateBankQuestions(bank.bankId, updated)
    onUpdate?.({ ...bank, questions: updated })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Search questions..." value={search} onChange={e=>setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex gap-2 text-sm text-gray-500">
          <span className="font-bold text-gray-800">{bank.questions.length}</span> total ·
          <span className="font-bold text-green-600">{bank.questions.filter(q=>q.correct!==null).length}</span> with answers
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {filtered.map((q) => {
          const isEditing = editingId === q.id
          const isExpanded = expandedId === q.id || isEditing
          return (
            <div key={q.id} className="card overflow-hidden">
              <div className="flex items-start gap-3 p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={()=>!isEditing && setExpandedId(isExpanded ? null : q.id)}>
                <span className="text-orange-500 font-mono font-bold text-sm mt-0.5 shrink-0">
                  {bank.questions.indexOf(q)+1}
                </span>
                {isEditing ? (
                  <textarea className="flex-1 min-h-[60px] text-sm resize-y" value={editData.question}
                    onChange={e=>setEditData(p=>({...p,question:e.target.value}))} onClick={e=>e.stopPropagation()} />
                ) : (
                  <p className="flex-1 text-sm text-gray-700 leading-relaxed">{q.question}</p>
                )}
                <div className="flex items-center gap-1 shrink-0" onClick={e=>e.stopPropagation()}>
                  {q.correct !== null && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">✓ Ans set</span>}
                  <button className="p-1.5 rounded text-gray-400 hover:text-blue-500 hover:bg-blue-50 transition-colors"
                    onClick={()=>isEditing ? saveEdit(q.id) : startEdit(q)}>
                    {isEditing ? <Check size={15}/> : <Edit2 size={15}/>}
                  </button>
                  {isEditing ? (
                    <button className="p-1.5 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                      onClick={()=>setEditingId(null)}><X size={15}/></button>
                  ) : (
                    <button className="p-1.5 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                      onClick={()=>deleteQuestion(q.id)}><Trash2 size={15}/></button>
                  )}
                  {!isEditing && (isExpanded ? <ChevronUp size={15} className="text-gray-400"/> : <ChevronDown size={15} className="text-gray-400"/>)}
                </div>
              </div>
              {isExpanded && (
                <div className="border-t border-gray-100 p-4 pt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 bg-gray-50">
                  {(isEditing ? editData.options : q.options).map((opt,i) => {
                    const letter = ['A','B','C','D','E'][i]
                    const isCorrect = (isEditing ? editData.correct : q.correct) === i
                    return (
                      <div key={i} className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all
                        ${isCorrect ? 'border-green-400 bg-green-50' : 'border-gray-200 bg-white'}`}>
                        <span className={`font-bold shrink-0 ${isCorrect ? 'text-green-600' : 'text-gray-400'}`}>{letter}.</span>
                        {isEditing ? (
                          <input className="flex-1 bg-transparent border-none p-0 text-sm shadow-none" value={opt}
                            onChange={e=>{const opts=[...editData.options];opts[i]=e.target.value;setEditData(p=>({...p,options:opts}))}}/>
                        ) : (
                          <span className="flex-1 text-gray-700">{opt}</span>
                        )}
                        <button
                          className={`text-xs px-2 py-0.5 rounded font-semibold transition-colors ${isCorrect ? 'bg-green-200 text-green-700' : 'bg-gray-100 text-gray-500 hover:bg-green-100 hover:text-green-700'}`}
                          onClick={e=>{e.stopPropagation();isEditing ? setEditData(p=>({...p,correct:i})) : setCorrectAnswer(q.id,i)}}>
                          {isCorrect ? '✓ Correct' : 'Set Ans'}
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
        {filtered.length===0 && <div className="text-center py-12 text-gray-400">No questions found matching "{search}"</div>}
      </div>
    </div>
  )
}
