import React, { useEffect, useRef } from 'react'
import { Clock } from 'lucide-react'

export default function Timer({ secondsLeft, onExpire, onTick }) {
  const ref = useRef(secondsLeft)
  useEffect(() => { ref.current = secondsLeft }, [secondsLeft])
  useEffect(() => {
    const interval = setInterval(() => {
      if (ref.current <= 1) { clearInterval(interval); onExpire?.() }
      else onTick?.(ref.current - 1)
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  const h = Math.floor(secondsLeft / 3600)
  const m = Math.floor((secondsLeft % 3600) / 60)
  const s = secondsLeft % 60
  const isWarning = secondsLeft < 300
  const isCritical = secondsLeft < 60
  const fmt = n => String(n).padStart(2, '0')

  return (
    <div className={`flex items-center gap-2 font-mono font-semibold text-base px-3 py-1.5 rounded-lg border
      ${isCritical ? 'border-red-400 bg-red-50 text-red-600 timer-warning' :
        isWarning ? 'border-yellow-400 bg-yellow-50 text-yellow-700' :
        'border-green-300 bg-green-50 text-green-700'}`}>
      <Clock size={15} />
      {h > 0 && <span>{fmt(h)}:</span>}
      <span>{fmt(m)}:{fmt(s)}</span>
    </div>
  )
}
