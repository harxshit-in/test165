function getUserKey() {
  try { return localStorage.getItem('user_gemini_api_key') || '' } catch { return '' }
}

// Convert File to base64
async function fileToBase64(file) {
  const buf = await file.arrayBuffer()
  const bytes = new Uint8Array(buf)
  let binary = ''
  for (let i = 0; i < bytes.length; i += 8192)
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192))
  return btoa(binary)
}

// PRIMARY: Send raw PDF to Gemini File API — no rendering needed
// Gemini reads it exactly like NotebookLM does
export async function extractFromPDF(file, onProgress) {
  onProgress?.(5, 'Reading PDF file...')

  const pdfBase64  = await fileToBase64(file)
  const userApiKey = getUserKey()

  onProgress?.(20, 'Sending PDF to Gemini AI (File API)...')

  const res  = await fetch('/api/gemini', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ pdfBase64, userApiKey })
  })

  const data = await res.json()

  if (res.status === 429) throw Object.assign(new Error(data.error || 'Rate limit'), { rateLimited: true })
  if (res.status === 403) throw Object.assign(new Error('Invalid API key. Check Settings.'), { keyError: true })
  if (!res.ok) throw new Error(data.error || `Server error ${res.status}`)

  onProgress?.(90, `Processing ${data.questions?.length || 0} questions...`)
  return normalize(data.questions)
}

// FALLBACK: Send page images if PDF mode fails
export async function extractFromImages(images, onProgress) {
  if (!images?.length) throw new Error('No pages')
  const pages      = images.slice(0, 20)
  const userApiKey = getUserKey()

  onProgress?.(10, `Sending ${pages.length} pages to AI...`)

  const res  = await fetch('/api/gemini', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ images: pages, userApiKey })
  })

  const data = await res.json()

  if (res.status === 429) throw Object.assign(new Error(data.error || 'Rate limit'), { rateLimited: true })
  if (res.status === 403) throw Object.assign(new Error('Invalid API key. Check Settings.'), { keyError: true })
  if (!res.ok) throw new Error(data.error || `Server error ${res.status}`)

  onProgress?.(90, `Processing ${data.questions?.length || 0} questions...`)
  return normalize(data.questions)
}

function normalize(questions) {
  return (questions || []).map((q, i) => ({
    id:       `q_${Date.now()}_${i}`,
    question: String(q.question || '').trim(),
    options:  (q.options || []).map(o => String(o||'').trim()).filter(Boolean).slice(0,4),
    correct:  (typeof q.correct==='number' && q.correct>=0 && q.correct<=3) ? q.correct : null,
  })).filter(q => q.question.length > 5 && q.options.length >= 2)
}
