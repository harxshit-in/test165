import React from 'react'

const STATUS_STYLES = {
  answered:         'bg-green-500 text-white',
  'not-answered':   'bg-red-400 text-white',
  marked:           'bg-purple-500 text-white',
  'marked-answered':'bg-purple-700 text-white',
  'not-visited':    'bg-gray-200 text-gray-600',
}

export default function NavigationGrid({ questions, answers, markedForReview, currentIndex, onJump }) {
  function getStatus(idx) {
    const q = questions[idx]
    const hasAnswer = answers[q.id] !== undefined && answers[q.id] !== null
    const isMarked = markedForReview.has(q.id)
    if (isMarked && hasAnswer) return 'marked-answered'
    if (isMarked) return 'marked'
    if (hasAnswer) return 'answered'
    if (idx < currentIndex) return 'not-answered'
    return 'not-visited'
  }

  const counts = { answered:0,'not-answered':0,marked:0,'not-visited':0,'marked-answered':0 }
  questions.forEach((_,i) => { counts[getStatus(i)]++ })

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col gap-4">
      <h3 className="font-bold text-sm text-gray-500 uppercase tracking-wider">Question Palette</h3>
      <div className="grid grid-cols-2 gap-1.5 text-xs">
        {[['answered','Answered'],['not-answered','Not Answered'],['marked','Marked Review'],['not-visited','Not Visited']].map(([key,label])=>(
          <div key={key} className="flex items-center gap-1.5">
            <div className={`w-4 h-4 rounded ${STATUS_STYLES[key]}`}/>
            <span className="text-gray-500">{label} ({counts[key]})</span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-5 gap-1.5 max-h-96 overflow-y-auto pr-1">
        {questions.map((q,idx)=>{
          const status = getStatus(idx)
          const isActive = idx === currentIndex
          return (
            <button key={q.id} onClick={()=>onJump(idx)}
              className={`question-grid-btn ${STATUS_STYLES[status]}
                ${isActive ? 'ring-2 ring-orange-400 ring-offset-1' : ''}`}
              title={`Q${idx+1}: ${status}`}>
              {idx+1}
            </button>
          )
        })}
      </div>
    </div>
  )
}
