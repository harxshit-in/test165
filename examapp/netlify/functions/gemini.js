// Netlify Function — 26 second timeout (Netlify default is 10s, background is 26s)
// We use synchronous handler but keep Gemini calls fast

exports.handler = async function(event, context) {
  // Netlify free tier: 10 second timeout per function
  // We must respond within 10s — keep image small, one model only

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  const apiKey = event.headers['x-user-api-key'] || process.env.GEMINI_API_KEY
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'GEMINI_API_KEY not set in Netlify environment variables.' }) }
  }

  const VISION_PROMPT = `You are analyzing a page from an Indian competitive exam paper.

RULES:
1. Extract ONLY English MCQ questions — ignore all Hindi/Devanagari text completely
2. Ignore garbled text like "firk vkSj iq=k orZeku vk;q gSA dh dk" — this is corrupted Hindi font, skip it
3. A valid question: numbered (1. Q1. etc) + complete English sentence + 4 options (a)(b)(c)(d)
4. Extract all 4 option texts completely
5. If answer key present (Ans.(b) or "1.(b) 2.(c)" block) set correct: a=0,b=1,c=2,d=3
6. SKIP: cover pages, author names, "Aditya Ranjan", "Join Telegram", phone numbers, Hindi-only lines
7. SKIP: open-ended questions with no (a)(b)(c)(d) options
8. Preserve math: x² + 1/x, a³ - 1/a³, √3 etc exactly

Return ONLY valid JSON array, no markdown, no explanation:
[{"question":"English question text?","options":["a text","b text","c text","d text"],"correct":1}]
Empty page = return: []`

  try {
    const body = JSON.parse(event.body || '{}')
    const { images } = body

    if (!images?.length) {
      // 400 = request understood, key is valid — used by Settings key test
      return { statusCode: 400, body: JSON.stringify({ error: 'No images provided', keyValid: true }) }
    }

    const all  = []
    const seen = new Set()

    for (const img of images) {
      let raw = ''
      let success = false

      // Try gemini-2.0-flash first (fastest), then fallback
      for (const model of ['gemini-2.0-flash', 'gemini-1.5-flash-latest']) {
        try {
          const controller = new AbortController()
          const timeout = setTimeout(() => controller.abort(), 8000) // 8s per page

          const r = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              signal: controller.signal,
              body: JSON.stringify({
                contents: [{
                  parts: [
                    { text: VISION_PROMPT },
                    { inline_data: { mime_type: img.mimeType || 'image/jpeg', data: img.base64 } }
                  ]
                }],
                generationConfig: { temperature: 0.01, maxOutputTokens: 4096 }
              })
            }
          )
          clearTimeout(timeout)

          if (r.status === 429) {
            return {
              statusCode: 429,
              body: JSON.stringify({ error: 'Rate limit reached. Add your own API key in Settings.', rateLimited: true })
            }
          }
          if (r.status === 403 || r.status === 400) {
            const e = await r.json().catch(() => ({}))
            return { statusCode: r.status, body: JSON.stringify({ error: e?.error?.message || 'API key error' }) }
          }
          if (!r.ok) { continue }

          const d = await r.json()
          raw = d?.candidates?.[0]?.content?.parts?.[0]?.text || ''
          success = true
          break
        } catch (e) {
          if (e.name === 'AbortError') continue // timeout — try next model
          console.error('Model error:', e.message)
        }
      }

      if (!success || !raw) continue

      // Parse JSON from response
      const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
      let questions = []
      try {
        const parsed = JSON.parse(cleaned)
        if (Array.isArray(parsed)) questions = parsed
      } catch {
        const m = cleaned.match(/\[[\s\S]*?\]/)
        if (m) { try { questions = JSON.parse(m[0]) } catch {} }
      }

      // Validate and deduplicate
      for (const q of questions) {
        if (!q?.question || typeof q.question !== 'string') continue
        if (q.question.trim().length < 10) continue
        if (!Array.isArray(q.options)) continue
        if (q.options.filter(o => String(o||'').trim().length > 0).length < 2) continue

        const k = q.question.slice(0, 60).toLowerCase().replace(/\s+/g, '')
        if (seen.has(k)) continue
        seen.add(k)

        all.push({
          question: q.question.trim(),
          options:  q.options.map(o => String(o||'').trim()).filter(Boolean).slice(0, 4),
          correct:  (typeof q.correct === 'number' && q.correct >= 0 && q.correct <= 3) ? q.correct : null
        })
      }
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questions: all, mode: 'vision' })
    }

  } catch (err) {
    console.error('Function error:', err)
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) }
  }
}
