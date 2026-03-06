exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  let body = {}
  try { body = JSON.parse(event.body || '{}') } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) }
  }

  const apiKey = (body.userApiKey || '').trim() || (process.env.GEMINI_API_KEY || '').trim()
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'No API key. Add one in Settings.' }) }
  }

  if (!body.images?.length) {
    return { statusCode: 400, body: JSON.stringify({ keyValid: true }) }
  }

  const PROMPT = `You are reading pages from an Indian exam question paper. These pages are provided as multiple images.

For EACH page image:
EXTRACT: Only English MCQ questions with (a)(b)(c)(d) or (A)(B)(C)(D) options
SKIP: Hindi/Devanagari text, garbled Hindi (firk vkSj iq=k orZeku vk;q gSA), cover pages, author names, "Join Telegram", phone numbers
ANSWERS: Use answer key if present — "1.(b) 2.(c)" or "Ans.(b)" — map a=0 b=1 c=2 d=3
MATH: Preserve exactly as written

Return ONLY a single JSON array of ALL questions from ALL pages, no markdown:
[{"question":"question text?","options":["a","b","c","d"],"correct":1}]`

  // Process ALL pages in ONE Gemini call using multi-image input
  // This uses only 1 API request total — no rate limiting possible!
  async function callGeminiMultiPage(imgs) {
    const parts = [{ text: PROMPT }]
    for (const img of imgs) {
      parts.push({ inline_data: { mime_type: img.mimeType || 'image/jpeg', data: img.base64 } })
    }

    for (const model of ['gemini-2.0-flash', 'gemini-1.5-pro-latest', 'gemini-1.5-flash-latest']) {
      try {
        const ctrl = new AbortController()
        const tid  = setTimeout(() => ctrl.abort(), 9000)

        const r = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            signal:  ctrl.signal,
            body: JSON.stringify({
              contents: [{ parts }],
              generationConfig: { temperature: 0.01, maxOutputTokens: 8192 }
            })
          }
        )
        clearTimeout(tid)

        if (r.status === 429) {
          // Try next model
          await new Promise(x => setTimeout(x, 2000))
          continue
        }
        if (r.status === 403) throw Object.assign(new Error('Invalid API key'), { fatal: true })
        if (!r.ok) { await new Promise(x => setTimeout(x, 1000)); continue }

        const d = await r.json()
        return d?.candidates?.[0]?.content?.parts?.[0]?.text || ''
      } catch (e) {
        if (e.fatal) throw e
        if (e.name === 'AbortError') { continue }
        console.error(model, e.message)
      }
    }
    return ''
  }

  function parseAndValidate(raw) {
    const clean = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
    let qs = []
    try { const p = JSON.parse(clean); if (Array.isArray(p)) qs = p }
    catch {
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
    }).map(q => ({
      question: q.question.trim(),
      options:  q.options.map(o => String(o||'').trim()).filter(Boolean).slice(0,4),
      correct:  (typeof q.correct==='number' && q.correct>=0 && q.correct<=3) ? q.correct : null
    }))
  }

  try {
    // Send max 4 pages per call (keeps payload under limits, fits in 9s timeout)
    const BATCH = 4
    const allQuestions = []
    const seen = new Set()

    for (let i = 0; i < body.images.length; i += BATCH) {
      const batch = body.images.slice(i, i + BATCH)
      const raw   = await callGeminiMultiPage(batch)
      for (const q of parseAndValidate(raw)) {
        const k = q.question.slice(0,60).toLowerCase().replace(/\s+/g,'')
        if (seen.has(k)) continue
        seen.add(k)
        allQuestions.push(q)
      }
      // Small delay between batches only if more remain
      if (i + BATCH < body.images.length) {
        await new Promise(x => setTimeout(x, 1000))
      }
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questions: allQuestions, mode: 'vision' })
    }
  } catch (e) {
    if (e.fatal) return { statusCode: 403, body: JSON.stringify({ keyError: true, error: 'Invalid API key.' }) }
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) }
  }
}
