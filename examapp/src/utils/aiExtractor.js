export async function extractFromImages(images, onProgress) {
  if (!images?.length) throw new Error('No pages to process')

  const pages = images.slice(0, 30)
  const total = pages.length
  onProgress?.(2, `Starting — ${total} pages...`, 0, total)

  const all  = []
  const seen = new Set()

  for (let i = 0; i < pages.length; i++) {
    const pageNum = pages[i].pageNum || (i + 1)
    onProgress?.(5 + Math.round((i / total) * 88), `AI reading page ${pageNum} of ${total}...`, i, total)

    try {
      // ALWAYS read key fresh from localStorage — never cache
      const userApiKey = (() => { try { return localStorage.getItem('user_gemini_api_key') || '' } catch { return '' } })()

      const res  = await fetch('/api/gemini', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ images: [pages[i]], userApiKey })
      })

      const data = await res.json()

      if (res.status === 429) throw Object.assign(new Error(data.error || 'Rate limit'), { rateLimited: true })
      if (!res.ok) { console.warn(`Page ${pageNum}:`, data.error); continue }

      for (const q of (data.questions || [])) {
        if (!q?.question || !Array.isArray(q?.options)) continue
        const k = q.question.slice(0,60).toLowerCase().replace(/\s+/g,'')
        if (seen.has(k)) continue
        seen.add(k)
        all.push({
          id:       `q_${Date.now()}_${all.length}`,
          question: String(q.question).trim(),
          options:  q.options.map(o => String(o||'').trim()).filter(Boolean).slice(0,4),
          correct:  (typeof q.correct==='number' && q.correct>=0 && q.correct<=3) ? q.correct : null,
        })
      }
    } catch (e) {
      if (e.rateLimited) throw e
      console.warn(`Page ${pageNum}:`, e.message)
    }

    if (i < pages.length - 1) await new Promise(r => setTimeout(r, 1500))
  }

  return all
}
