import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getBank } from '../utils/storage'
import QuestionBank from '../components/QuestionBank'
import { BookOpen, Play, ArrowLeft } from 'lucide-react'

export default function QuestionBankPage() {
  const { bankId } = useParams()
  const [bank, setBank] = useState(null)
  const [loading, setLoading] = useState(true)
  useEffect(()=>{ getBank(bankId).then(b=>{setBank(b);setLoading(false)}) },[bankId])

  if (loading) return <div className="flex items-center justify-center h-48"><div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"/></div>
  if (!bank) return <div className="text-center py-20 text-gray-400">Bank not found. <Link to="/" className="text-orange-500">Go home</Link></div>

  return (
    <div className="flex flex-col gap-5 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <Link to="/" className="text-sm text-gray-400 hover:text-gray-700 flex items-center gap-1 mb-1"><ArrowLeft size={14}/> Back</Link>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><BookOpen size={22} className="text-orange-500"/>{bank.name}</h1>
          <p className="text-gray-400 text-sm mt-0.5">{bank.questions.length} questions · {bank.source}</p>
        </div>
        <Link to={`/bank/${bankId}/tests`} className="btn-primary flex items-center gap-2"><Play size={15}/> Create Tests</Link>
      </div>
      <QuestionBank bank={bank} onUpdate={setBank}/>
    </div>
  )
}
