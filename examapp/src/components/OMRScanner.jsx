import React, { useRef, useState, useEffect } from 'react'
import { Camera, CameraOff, ScanLine, CheckCircle2 } from 'lucide-react'
import { processOMRImage, captureFrame } from '../utils/omrProcessor'

export default function OMRScanner({ questions=[], onResult }) {
  const videoRef = useRef(); const canvasRef = useRef()
  const [streaming, setStreaming] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [detectedAnswers, setDetectedAnswers] = useState(null)
  const [rowCount, setRowCount] = useState(questions.length||20)
  const streamRef = useRef(null)

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}})
      streamRef.current = stream; videoRef.current.srcObject = stream
      videoRef.current.play(); setStreaming(true)
    } catch(err) { alert('Camera access denied: '+err.message) }
  }
  function stopCamera() { streamRef.current?.getTracks().forEach(t=>t.stop()); setStreaming(false); setDetectedAnswers(null) }
  async function scanOMR() {
    setScanning(true)
    try {
      const canvas = await captureFrame(videoRef.current)
      canvasRef.current.width=canvas.width; canvasRef.current.height=canvas.height
      canvasRef.current.getContext('2d').drawImage(canvas,0,0)
      const answers = processOMRImage(canvas,rowCount)
      setDetectedAnswers(answers); onResult?.(answers)
    } catch(err) { alert('Scan failed: '+err.message) } finally { setScanning(false) }
  }
  useEffect(()=>()=>streamRef.current?.getTracks().forEach(t=>t.stop()),[])

  return (
    <div className="flex flex-col gap-5">
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-800 flex items-center gap-2"><ScanLine size={16} className="text-orange-500"/> OMR Scanner</h3>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-500 font-medium">Rows:</label>
            <input type="number" min={1} max={200} value={rowCount} onChange={e=>setRowCount(parseInt(e.target.value)||20)} className="w-20 text-sm"/>
          </div>
        </div>
        <p className="text-sm text-gray-500 mb-4">Point your camera at an OMR sheet. The scanner detects filled A/B/C/D bubbles row by row.</p>
        <div className="relative rounded-xl overflow-hidden bg-gray-800 border border-gray-300 aspect-video max-w-lg mx-auto">
          <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
          {!streaming && <div className="absolute inset-0 flex items-center justify-center flex-col gap-3 text-gray-400"><CameraOff size={40}/><span className="text-sm">Camera not started</span></div>}
          {streaming && <div className="absolute top-2 right-2 bg-red-500 rounded-full w-2.5 h-2.5 animate-pulse"/>}
        </div>
        <canvas ref={canvasRef} className="hidden"/>
        <div className="flex gap-3 mt-4 justify-center flex-wrap">
          {!streaming ? (
            <button className="btn-primary flex items-center gap-2" onClick={startCamera}><Camera size={16}/> Start Camera</button>
          ) : (
            <>
              <button className="btn-primary flex items-center gap-2" onClick={scanOMR} disabled={scanning}>
                <ScanLine size={16}/> {scanning ? 'Scanning...' : 'Scan OMR'}
              </button>
              <button className="btn-secondary flex items-center gap-2" onClick={stopCamera}><CameraOff size={16}/> Stop</button>
            </>
          )}
        </div>
      </div>
      {detectedAnswers && (
        <div className="card p-4">
          <h4 className="font-semibold text-green-600 flex items-center gap-2 mb-3"><CheckCircle2 size={16}/> Detected Answers ({detectedAnswers.filter(Boolean).length}/{detectedAnswers.length})</h4>
          <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
            {detectedAnswers.map((ans,i)=>(
              <div key={i} className="flex flex-col items-center gap-0.5">
                <span className="text-xs text-gray-400">Q{i+1}</span>
                <span className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-sm
                  ${ans ? 'bg-blue-100 border border-blue-400 text-blue-700' : 'bg-gray-100 border border-gray-200 text-gray-400'}`}>{ans??'—'}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
