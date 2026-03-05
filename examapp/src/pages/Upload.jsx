import React from 'react'
import { useNavigate } from 'react-router-dom'
import PDFUploader from '../components/PDFUploader'
import { FileText } from 'lucide-react'

export default function Upload() {
  const nav = useNavigate()
  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
          <FileText size={28} className="text-orange-500"/> Upload PDF
        </h1>
        <p className="text-gray-500 mt-1">Upload any MCQ PDF — the parser auto-detects questions regardless of format.</p>
      </div>
      <PDFUploader onBankCreated={bank=>setTimeout(()=>nav(`/bank/${bank.bankId}`),800)}/>
    </div>
  )
}
