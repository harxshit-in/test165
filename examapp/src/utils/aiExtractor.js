// Call Gemini DIRECTLY from browser — no server, no timeout, no rate limit issues
// User's key stays in their browser — never sent to our server
// This is exactly how NotebookLM works under the hood

const GEMINI_MODELS = ['gemini-2.0-flash', 'gemini-1.5-flash-latest', 'gemini-1.5-pro-latest']

const PROMPT = `You are reading an Indian competitive exam question paper.

EXTRACT: Every English MCQ question that has (a)(b)(c)(d) or (A)(B)(C)(D) options.

RULES:
- Extract the ENGLISH version only — skip Hindi translations below each question
- Each question starts with a number: 1. or Q1. or Q.1
- Each question has 4 options (a)(b)(c)(d)
- If answer key exists like "1.(b) 2.(c) 3.(d)" — set correct answers (a=0 b=1 c=2 d=3)
- If "Ans.(b)" near a question — use it

SKIP:
- Hindi/Devanagari text
- Garbled Hindi font: "firk vkSj iq=k orZeku vk;q gSA dk dh" etc
- Cover pages, "Aditya Ranjan", "Physics Wallah", "Join Telegram", phone numbers
- Open-ended questions with no (a)(b)(c)(d) options

KEEP: Math exactly — x² + 1/x, a³ - 1/a³, √3, ₹, %

Return ONLY JSON array, no markdown:
[{"question":"question text?","options":["a","b","c","d"],"correct":1}]`

function getKey() {
  // Use user's own key if saved, otherwise use the env key via server
  try { return localStorage.getItem('user_gemini_api_key') || '' } catch { return '' }
}

async function callGeminiDirect(parts, apiKey) {
  for (const model of GEMINI_MODELS) {
    try {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts }],
            generationConfig: { temperature: 0.01, maxOutputTokens: 8192 }
          })
        }
      )
      if (r.status === 429) {
        await new Promise(x => setTimeout(x, 3000))
        continue
      }
      if (r.status === 403) throw Object.assign(new Error('Invalid API key. Go to Settings and check your key.'), { keyError: true })
      if (!r.ok) { await new Promise(x => setTimeout(x, 1000)); continue }
      const d = await r.json()
      return d?.candidates?.[0]?.content?.parts?.[0]?.text || ''
    } catch (e) {
      if (e.keyError) throw e
      console.warn(model, e.message)
    }
  }
  throw new Error('All Gemini models failed')
}

async function callGeminiViaServer(parts, userApiKey) {
  // Fallback: route through Netlify function (has timeout but works for small PDFs)
  const body = { userApiKey }
  // Separate images from text parts
  const textParts = parts.filter(p => p.text)
  const imgParts  = parts.filter(p => p.inline_data)
  if (imgParts.length) body.images = imgParts.map(p => ({ base64: p.inline_data.data, mimeType: p.inline_data.mime_type }))
  if (textParts.find(p => p.inline_data?.mime_type === 'application/pdf')) body.pdfBase64 = textParts.find(p => p.inline_data?.mime_type === 'application/pdf').inline_data.data

  const res  = await fetch('/api/gemini', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || `Server error ${res.status}`)
  return JSON.stringify(data.questions || [])
}

function parseQuestions(raw) {
  const clean = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
  let qs = []
  try { const p = JSON.parse(clean); if (Array.isArray(p)) qs = p } catch {
    const m = clean.match(/\[[\s\S]*\]/)
    if (m) try { qs = JSON.parse(m[0]) } catch {}
  }
  const seen = new Set()
  return qs.filter(q => {
    if (!q?.question || q.question.trim().length < 10) return false
    if (!Array.isArray(q.options) || q.options.filter(o => String(o||'').trim()).length < 2) return false
    const k = q.question.slice(0,60).toLowerCase().replace(/\s+/g,'')
    if (seen.has(k)) return false
    seen.add(k); return true
  }).map((q, i) => ({
    id:       `q_${Date.now()}_${i}`,
    question: q.question.trim(),
    options:  q.options.map(o => String(o||'').trim()).filter(Boolean).slice(0,4),
    correct:  (typeof q.correct==='number' && q.correct>=0 && q.correct<=3) ? q.correct : null
  }))
}

// MAIN: Extract from raw PDF file — tries direct browser call first
export async function extractFromPDF(file, onProgress) {
  onProgress?.(5, 'Reading PDF...')

  const buf    = await file.arrayBuffer()
  const bytes  = new Uint8Array(buf)
  let binary   = ''
  for (let i = 0; i < bytes.length; i += 8192)
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192))
  const pdfBase64 = btoa(binary)

  const userKey = getKey()
  const parts   = [
    { text: PROMPT },
    { inline_data: { mime_type: 'application/pdf', data: pdfBase64 } }
  ]

  let raw = ''

  if (userKey) {
    // Has user key → call Gemini DIRECTLY from browser (no timeout!)
    onProgress?.(15, 'Sending PDF directly to Gemini AI...')
    raw = await callGeminiDirect(parts, userKey)
  } else {
    // No user key → route through Netlify function using server key
    onProgress?.(15, 'Sending PDF via server...')
    const res  = await fetch('/api/gemini', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ pdfBase64, userApiKey: '' })
    })
    const data = await res.json()
    if (res.status === 429) throw Object.assign(new Error('Rate limit. Add your own free API key in Settings for unlimited use.'), { rateLimited: true })
    if (!res.ok) throw new Error(data.error || 'Server error')
    return parseQuestions(JSON.stringify(data.questions || []))
  }

  onProgress?.(85, 'Parsing questions...')
  return parseQuestions(raw)
}

// FALLBACK: Extract from page images
export async function extractFromImages(images, onProgress) {
  if (!images?.length) throw new Error('No pages')

  const userKey = getKey()
  const pages   = images.slice(0, 20)
  const BATCH   = 4
  const all     = []
  const seen    = new Set()

  for (let i = 0; i < pages.length; i += BATCH) {
    const batch = pages.slice(i, i + BATCH)
    const pct   = Math.round((i / pages.length) * 80)
    onProgress?.(10 + pct, `Reading pages ${i+1}–${Math.min(i+BATCH, pages.length)} of ${pages.length}...`)

    const parts = [{ text: PROMPT }, ...batch.map(img => ({
      inline_data: { mime_type: img.mimeType || 'image/jpeg', data: img.base64 }
    }))]

    let raw = ''
    if (userKey) {
      raw = await callGeminiDirect(parts, userKey)
    } else {
      const res  = await fetch('/api/gemini', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ images: batch.map(img => ({ base64: img.base64, mimeType: img.mimeType })), userApiKey: '' })
      })
      const data = await res.json()
      if (res.status === 429) throw Object.assign(new Error('Rate limit. Add your free API key in Settings.'), { rateLimited: true })
      if (!res.ok) throw new Error(data.error || 'Server error')
      raw = JSON.stringify(data.questions || [])
    }

    for (const q of parseQuestions(raw)) {
      const k = q.question.slice(0,60).toLowerCase().replace(/\s+/g,'')
      if (seen.has(k)) continue
      seen.add(k); all.push(q)
    }

    if (i + BATCH < pages.length) await new Promise(r => setTimeout(r, 500))
  }

  return all
}
