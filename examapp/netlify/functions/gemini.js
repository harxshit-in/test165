exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  let body = {}
  try { body = JSON.parse(event.body || '{}') } catch { return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) } }

  // Get API key — user key from request body takes priority over server env key
  const apiKey = (body.userApiKey || '').trim() || process.env.GEMINI_API_KEY || ''
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'No API key. Set GEMINI_API_KEY in Netlify environment variables.' }) }
  }

  const { images } = body
  if (!images?.length) {
    return { statusCode: 400, body: JSON.stringify({ error: 'No images provided', keyValid: true }) }
  }

  const VISION_PROMPT = `You are analyzing a page from an Indian competitive exam paper.

RULES:
1. Extract ONLY English MCQ questions — ignore all Hindi/Devanagari text completely
2. Ignore garbled text like "firk vkSj iq=k orZeku vk;q gSA dh dk" — corrupted Hindi font, skip it
3. A valid question: numbered (1. Q1. etc) + complete English sentence + 4 options (a)(b)(c)(d)
4. Extract all 4 option texts completely
5. If answer key present (Ans.(b) or "1.(b) 2.(c)" block) set correct: a=0,b=1,c=2,d=3
6. SKIP: cover pages, author names, "Aditya Ranjan", "Join Telegram", phone numbers, Hindi-only lines
7. SKIP: open-ended questions with no (a)(b)(c)(d) options
8. Preserve math: x² + 1/x, a³ - 1/a³, √3 etc exactly

Return ONLY valid JSON array, no markdown:
[{"question":"English question?","options":["a","b","c","d"],"correct":1}]
Empty page = return: []`

  const all  = []
  const seen = new Set()

  for (const img of images) {
    let raw = ''
    for (const model of ['gemini-2.0-flash', 'gemini-1.5-flash-latest']) {
      try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 8500)
        const r = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
              contents: [{ parts: [
                { text: VISION_PROMPT },
                { inline_data: { mime_type: img.mimeType || 'image/jpeg', data: img.base64 } }
              ]}],
              generationConfig: { temperature: 0.01, maxOutputTokens: 4096 }
            })
          }
        )
        clearTimeout(timeout)
        if (r.status === 429) return { statusCode: 429, body: JSON.stringify({ error: 'Rate limit reached. Add your own API key in Settings.', rateLimited: true }) }
        if (r.status === 400) { const e = await r.json().catch(()=>({})); return { statusCode: 400, body: JSON.stringify({ error: e?.error?.message || 'Bad request' }) } }
        if (r.status === 403) return { statusCode: 403, body: JSON.stringify({ error: 'Invalid API key', keyError: true }) }
        if (!r.ok) { await new Promise(x => setTimeout(x, 500)); continue }
        const d = await r.json()
        raw = d?.candidates?.[0]?.content?.parts?.[0]?.text || ''
        break
      } catch (e) {
        if (e.name === 'AbortError') continue
        console.error(e.message)
      }
    }

    if (!raw) continue

    // Parse response
    const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
    let questions = []
    try { const p = JSON.parse(cleaned); if (Array.isArray(p)) questions = p }
    catch { const m = cleaned.match(/\[[\s\S]*\]/); if (m) try { questions = JSON.parse(m[0]) } catch {} }

    for (const q of questions) {
      if (!q?.question || q.question.trim().length < 10) continue
      if (!Array.isArray(q.options) || q.options.filter(o => String(o||'').trim()).length < 2) continue
      const k = q.question.slice(0,60).toLowerCase().replace(/\s+/g,'')
      if (seen.has(k)) continue
      seen.add(k)
      all.push({
        question: q.question.trim(),
        options:  q.options.map(o => String(o||'').trim()).filter(Boolean).slice(0,4),
        correct:  (typeof q.correct==='number' && q.correct>=0 && q.correct<=3) ? q.correct : null
      })
    }
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ questions: all, mode: 'vision' })
  }
}
