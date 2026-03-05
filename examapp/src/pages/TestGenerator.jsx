import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getBank, getTestsByBank } from '../utils/storage'
import TestGenerator from '../components/TestGenerator'
import { ArrowLeft, Zap } from 'lucide-react'

export default function TestGeneratorPage() {
  const { bankId } = useParams()
  const [bank, setBank] = useState(null)
  const [tests, setTests] = useState([])
  const [loading, setLoading] = useState(true)

  async function loadAll() {
    const [b,t] = await Promise.all([getBank(bankId),getTestsByBank(bankId)])
    setBank(b); setTests(t.sort((a,b)=>b.createdAt-a.createdAt)); setLoading(false)
  }
  useEffect(()=>{ loadAll() },[bankId])

  if (loading) return <div className="flex items-center justify-center h-48"><div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"/></div>
  if (!bank) return <div className="text-center py-20 text-gray-400">Bank not found. <Link to="/" className="text-orange-500">Go home</Link></div>

  return (
    <div className="flex flex-col gap-5 animate-fade-in">
      <div>
        <Link to={`/bank/${bankId}`} className="text-sm text-gray-400 hover:text-gray-700 flex items-center gap-1 mb-1"><ArrowLeft size={14}/> {bank.name}</Link>
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><Zap size={22} className="text-orange-500"/> Test Generator</h1>
        <p className="text-gray-400 text-sm mt-0.5">{bank.questions.length} questions available</p>
      </div>
      <TestGenerator bank={bank} tests={tests} onTestsChange={loadAll}/>
    </div>
  )
}
