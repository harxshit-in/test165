import React, { useState, useEffect } from 'react'
import OMRScanner from '../components/OMRScanner'
import { ScanLine } from 'lucide-react'
import { getAllBanks, getTestsByBank } from '../utils/storage'
import { calculateResult } from '../utils/testGenerator'
import { getTest } from '../utils/storage'
import { CheckCircle2 } from 'lucide-react'

export default function OMRScanPage() {
  const [selectedTestId, setSelectedTestId] = useState('')
  const [tests, setTests] = useState([])
  const [scannedResult, setScannedResult] = useState(null)

  useEffect(()=>{
    async function load() {
      const banks = await getAllBanks(); const allTests = []
      for (const b of banks) { const t = await getTestsByBank(b.bankId); allTests.push(...t) }
      setTests(allTests.sort((a,b)=>b.createdAt-a.createdAt))
    }
    load()
  },[])

  async function handleOMRResult(answers) {
    if (!selectedTestId) return
    const test = await getTest(selectedTestId); if (!test) return
    const mapped = {}; const letterToIdx={A:0,B:1,C:2,D:3}
    answers.forEach((letter,i)=>{ if(i<test.questions.length&&letter!==null) mapped[test.questions[i].id]=letterToIdx[letter]??null })
    const result = calculateResult(test,mapped)
    setScannedResult({...result,testName:test.name})
  }

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2"><ScanLine size={28} className="text-orange-500"/> OMR Scanner</h1>
        <p className="text-gray-500 mt-1">Scan a physical OMR sheet using your camera to automatically grade it.</p>
      </div>
      <div className="card p-4">
        <label className="block text-sm text-gray-600 mb-2 font-semibold">Select test to grade against:</label>
        <select value={selectedTestId} onChange={e=>setSelectedTestId(e.target.value)}>
          <option value="">— Select a test —</option>
          {tests.map(t=><option key={t.testId} value={t.testId}>{t.name} ({t.questionCount}Q)</option>)}
        </select>
      </div>
      <OMRScanner questions={selectedTestId?tests.find(t=>t.testId===selectedTestId)?.questions||[]:[]} onResult={handleOMRResult}/>
      {scannedResult && (
        <div className="card p-5">
          <h3 className="font-bold text-gray-800 text-lg mb-4 flex items-center gap-2"><CheckCircle2 size={18} className="text-green-500"/> OMR Result: {scannedResult.testName}</h3>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="bg-green-50 rounded-xl p-4 border border-green-200"><p className="text-3xl font-bold text-green-600">{scannedResult.correct}</p><p className="text-xs text-gray-500">Correct</p></div>
            <div className="bg-red-50 rounded-xl p-4 border border-red-200"><p className="text-3xl font-bold text-red-500">{scannedResult.incorrect}</p><p className="text-xs text-gray-500">Incorrect</p></div>
            <div className="bg-orange-50 rounded-xl p-4 border border-orange-200"><p className="text-3xl font-bold text-orange-500">{scannedResult.percentage}%</p><p className="text-xs text-gray-500">Score</p></div>
          </div>
        </div>
      )}
    </div>
  )
}
