// Read user's API key fresh from localStorage every time
function getUserKey() {
  try { return localStorage.getItem('user_gemini_api_key') || '' } catch { return '' }
}

export async function extractFromImages(images, onProgress) {
  if (!images?.length) throw new Error('No pages to process')

  const pages = images.slice(0, 30)
  const total = pages.length
  onProgress?.(2, `Starting — ${total} pages to process...`, 0, total)

  const all  = []
  const seen = new Set()
  let failures = 0

  for (let i = 0; i < pages.length; i++) {
    const pageNum = pages[i].pageNum || (i + 1)
    onProgress?.(
      5 + Math.round((i / total) * 88),
      `AI reading page ${pageNum} of ${total}...`,
      i, total
    )

    try {
      const userApiKey = getUserKey() // read fresh every request

      const res = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          images:     [pages[i]],
          userApiKey: userApiKey   // key goes in body — reliable through all proxies
        })
      })

      const data = await res.json()

      if (res.status === 429) throw Object.assign(new Error(data.error || 'Rate limit reached'), { rateLimited: true })
      if (!res.ok) { failures++; console.warn(`Page ${pageNum}:`, data.error); continue }

      failures = 0
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
      failures++
      if (failures > 5) throw new Error('Too many failures. Check your API key in Settings.')
      console.warn(`Page ${pageNum}:`, e.message)
    }

    if (i < pages.length - 1) await new Promise(r => setTimeout(r, 1200))
  }

  return all
}
