import { getUserApiKey } from '../pages/Settings'

function headers() {
  const h = { 'Content-Type': 'application/json' }
  const k = getUserApiKey()
  if (k) h['x-user-api-key'] = k
  return h
}

export async function extractFromImages(images, onProgress) {
  if (!images?.length) throw new Error('No pages to process')

  const MAX   = 30
  const pages = images.slice(0, MAX)
  const total = pages.length

  onProgress?.(2, `Starting AI extraction — ${total} pages...`, 0, total)

  const all  = []
  const seen = new Set()
  let   failures = 0

  for (let i = 0; i < pages.length; i++) {
    const pageNum = pages[i].pageNum || (i + 1)

    onProgress?.(
      5 + Math.round((i / total) * 88),
      `AI reading page ${pageNum} of ${total}...`,
      i, total
    )

    try {
      const res  = await fetch('/api/gemini', {
        method:  'POST',
        headers: headers(),
        body:    JSON.stringify({ images: [pages[i]] })
      })

      const data = await res.json()

      if (res.status === 429) {
        throw Object.assign(new Error(data.error || 'Rate limit reached'), { rateLimited: true })
      }

      if (!res.ok) {
        console.warn(`Page ${pageNum} error:`, data.error)
        failures++
        if (failures > 3) throw new Error('Too many failures — check API key in Settings')
        continue
      }

      const qs = Array.isArray(data.questions) ? data.questions : []
      for (const q of qs) {
        if (!q?.question || !Array.isArray(q?.options)) continue
        const k = q.question.slice(0, 60).toLowerCase().replace(/\s+/g, '')
        if (seen.has(k)) continue
        seen.add(k)
        all.push({
          id:       `q_${Date.now()}_${all.length}_${Math.random().toString(36).slice(2,5)}`,
          question: String(q.question).trim(),
          options:  q.options.map(o => String(o||'').trim()).filter(Boolean).slice(0, 4),
          correct:  (typeof q.correct === 'number' && q.correct >= 0 && q.correct <= 3)
                      ? q.correct : null,
        })
      }

      failures = 0 // reset on success

    } catch (e) {
      if (e.rateLimited) throw e
      console.warn(`Page ${pageNum} failed:`, e.message)
      failures++
      if (failures > 5) throw new Error('Multiple pages failed. Check your internet connection.')
    }

    // Rate limit: 15 req/min free tier = wait 1.2s between pages
    if (i < pages.length - 1) await new Promise(r => setTimeout(r, 1200))
  }

  onProgress?.(98, `Extracted ${all.length} questions from ${total} pages`, total, total)
  return all
}
