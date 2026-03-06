// Send ALL pages in ONE server request
// Server batches 4 pages per Gemini call = much fewer API requests = no rate limit

export async function extractFromImages(images, onProgress) {
  if (!images?.length) throw new Error('No pages to process')

  const pages = images.slice(0, 20)
  onProgress?.(10, `Sending ${pages.length} pages to Gemini AI...`, 0, pages.length)

  const userApiKey = (() => {
    try { return localStorage.getItem('user_gemini_api_key') || '' } catch { return '' }
  })()

  const res = await fetch('/api/gemini', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ images: pages, userApiKey })
  })

  onProgress?.(85, 'Processing results...', pages.length, pages.length)

  const data = await res.json()

  if (res.status === 429) throw Object.assign(new Error(data.error || 'Rate limit'), { rateLimited: true })
  if (res.status === 403) throw new Error('Invalid API key. Go to Settings and check your key.')
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`)

  const questions = (data.questions || []).map((q, i) => ({
    id:       `q_${Date.now()}_${i}`,
    question: String(q.question || '').trim(),
    options:  (q.options || []).map(o => String(o||'').trim()).filter(Boolean).slice(0,4),
    correct:  (typeof q.correct==='number' && q.correct>=0 && q.correct<=3) ? q.correct : null,
  })).filter(q => q.question.length > 5 && q.options.length >= 2)

  onProgress?.(98, `Done — ${questions.length} questions found!`, pages.length, pages.length)
  return questions
}
