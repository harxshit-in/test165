import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, Plus, Play, Trash2, FileText, Clock, TrendingUp, Award, Zap } from 'lucide-react'
import { getAllBanks, deleteBank, getAllResults } from '../utils/storage'

export default function Home() {
  const [banks, setBanks] = useState([])
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(()=>{
    async function load() {
      const [b,r] = await Promise.all([getAllBanks(),getAllResults()])
      setBanks(b.sort((a,b)=>b.createdAt-a.createdAt))
      setResults(r.sort((a,b)=>b.completedAt-a.completedAt))
      setLoading(false)
    }
    load()
  },[])

  async function handleDelete(bankId) {
    if (!confirm('Delete this question bank?')) return
    await deleteBank(bankId); setBanks(p=>p.filter(b=>b.bankId!==bankId))
  }

  const avgScore = results.length>0 ? Math.round(results.reduce((s,r)=>s+(r.percentage||0),0)/results.length) : null

  if (loading) return <div className="flex items-center justify-center h-48"><div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"/></div>

  return (
    <div className="flex flex-col gap-8 animate-fade-in">
      {banks.length===0 && (
        <div className="relative overflow-hidden card p-10 text-center bg-gradient-to-br from-orange-50 to-blue-50">
          <div className="font-display text-5xl text-orange-500 tracking-widest mb-2">EXAMPREP CBT</div>
          <p className="text-gray-500 text-lg mb-6 max-w-xl mx-auto">Convert PDF question papers into an interactive government exam-style CBT interface. Works offline.</p>
          <Link to="/upload" className="btn-primary inline-flex items-center gap-2 text-lg px-8 py-3">
            <Plus size={20}/> Upload Your First PDF
          </Link>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-10">
            {[{icon:FileText,label:'PDF Upload',desc:'Any MCQ paper'},{icon:BookOpen,label:'Question Bank',desc:'Edit & manage'},{icon:Zap,label:'CBT Interface',desc:'Govt exam style'},{icon:Award,label:'Results & Review',desc:'Detailed analysis'}].map(({icon:Icon,label,desc})=>(
              <div key={label} className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
                <Icon size={24} className="text-orange-500 mx-auto mb-2"/>
                <p className="font-semibold text-gray-700 text-sm">{label}</p>
                <p className="text-gray-400 text-xs mt-0.5">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {(banks.length>0||results.length>0) && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            {label:'Question Banks',value:banks.length,icon:BookOpen,color:'text-blue-500'},
            {label:'Total Questions',value:banks.reduce((s,b)=>s+b.questions.length,0),icon:FileText,color:'text-orange-500'},
            {label:'Tests Attempted',value:results.length,icon:Play,color:'text-green-500'},
            {label:'Avg Score',value:avgScore!==null?`${avgScore}%`:'—',icon:TrendingUp,color:'text-purple-500'},
          ].map(({label,value,icon:Icon,color})=>(
            <div key={label} className="card p-4 flex items-center gap-3">
              <Icon size={22} className={color}/>
              <div>
                <p className="text-xl font-bold text-gray-800">{value}</p>
                <p className="text-xs text-gray-400">{label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {banks.length>0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-gray-600 uppercase tracking-wider text-sm">Question Banks</h2>
            <Link to="/upload" className="btn-primary text-sm py-2 flex items-center gap-1.5"><Plus size={14}/> Add New</Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {banks.map(bank=>(
              <div key={bank.bankId} className="card p-5 flex flex-col gap-3 hover:border-orange-300 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-800 truncate">{bank.name}</h3>
                    <p className="text-xs text-gray-400 mt-0.5">{bank.source}</p>
                  </div>
                  <button onClick={()=>handleDelete(bank.bankId)} className="p-1.5 text-gray-300 hover:text-red-400 transition-colors rounded"><Trash2 size={14}/></button>
                </div>
                <div className="flex gap-2 text-sm items-center">
                  <span className="text-gray-800 font-bold text-xl">{bank.questions.length}</span>
                  <span className="text-gray-400">questions ·</span>
                  <span className="text-green-600 font-semibold">{bank.questions.filter(q=>q.correct!==null).length}</span>
                  <span className="text-gray-400">answered</span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{width:`${bank.questions.length>0?(bank.questions.filter(q=>q.correct!==null).length/bank.questions.length)*100:0}%`}}/>
                </div>
                <div className="flex gap-2">
                  <Link to={`/bank/${bank.bankId}`} className="btn-secondary text-sm py-2 flex-1 text-center">View Bank</Link>
                  <Link to={`/bank/${bank.bankId}/tests`} className="btn-primary text-sm py-2 flex-1 text-center flex items-center justify-center gap-1"><Play size={13}/> Tests</Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {results.length>0 && (
        <div>
          <h2 className="font-bold text-gray-600 uppercase tracking-wider text-sm mb-3">Recent Results</h2>
          <div className="flex flex-col gap-2">
            {results.slice(0,5).map(r=>(
              <Link key={r.testId} to={`/result/${r.testId}`} className="card p-4 flex items-center gap-4 hover:border-orange-300 transition-colors">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg shrink-0
                  ${r.percentage>=70?'bg-green-100 text-green-700':r.percentage>=40?'bg-yellow-100 text-yellow-700':'bg-red-100 text-red-700'}`}>
                  {r.percentage}%
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-800 truncate">{r.testName||r.testId}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{r.correct}/{r.total} correct · {new Date(r.completedAt).toLocaleDateString()}</p>
                </div>
                <Clock size={14} className="text-gray-300 shrink-0"/>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
