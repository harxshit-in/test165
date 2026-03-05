import React, { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { loadSharedTest } from '../firebase/shareTest'
import { saveTest, getTest } from '../utils/storage'
import { Share2, Play, AlertCircle, Loader } from 'lucide-react'

export default function SharedTestPage() {
  const [params] = useSearchParams(); const nav = useNavigate()
  const id = params.get('id')
  const [state, setState] = useState('loading')
  const [testData, setTestData] = useState(null)
  const [error, setError] = useState('')

  useEffect(()=>{
    if (!id) { setState('no-id'); return }
    loadSharedTest(id).then(data=>{setTestData(data);setState('ready')}).catch(err=>{setError(err.message);setState('error')})
  },[id])

  async function startTest() {
    const localTestId = `shared_${id}`
    const existing = await getTest(localTestId)
    if (!existing) await saveTest({testId:localTestId,name:testData.name,timeLimit:testData.timeLimit,questions:testData.questions,questionCount:testData.questions.length,bankId:'shared',createdAt:Date.now(),isShared:true})
    nav(`/test/${localTestId}`)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center shadow-lg border border-gray-200">
        {state==='loading' && <div className="flex flex-col items-center gap-3 text-gray-400"><Loader size={32} className="animate-spin text-orange-500"/><p>Loading shared test...</p></div>}
        {state==='error' && <div className="flex flex-col items-center gap-3"><AlertCircle size={40} className="text-red-400"/><p className="text-red-500 font-semibold">Failed to load test</p><p className="text-gray-400 text-sm">{error}</p></div>}
        {state==='no-id' && <div className="flex flex-col items-center gap-3"><Share2 size={40} className="text-gray-300"/><p className="text-gray-400">No test ID in URL.</p></div>}
        {state==='ready' && testData && (
          <div className="flex flex-col items-center gap-5">
            <div className="w-16 h-16 rounded-full bg-orange-100 border-2 border-orange-300 flex items-center justify-center"><Share2 size={28} className="text-orange-500"/></div>
            <div><h2 className="text-2xl font-bold text-gray-800 mb-1">{testData.name}</h2><p className="text-gray-400 text-sm">Shared test</p></div>
            <div className="flex gap-4 text-sm">
              <div className="bg-gray-50 rounded-xl px-4 py-3 text-center border border-gray-200"><p className="text-xl font-bold text-gray-800">{testData.questions?.length}</p><p className="text-gray-400 text-xs">Questions</p></div>
              <div className="bg-gray-50 rounded-xl px-4 py-3 text-center border border-gray-200"><p className="text-xl font-bold text-gray-800">{Math.round((testData.timeLimit||0)/60)}</p><p className="text-gray-400 text-xs">Minutes</p></div>
            </div>
            <button className="btn-primary w-full flex items-center justify-center gap-2 text-lg py-3" onClick={startTest}><Play size={18}/> Start Test</button>
          </div>
        )}
      </div>
    </div>
  )
}
