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

  // Key test ping
  if (!body.pdfBase64 && !body.images?.length) {
    return { statusCode: 400, body: JSON.stringify({ keyValid: true }) }
  }

  const PROMPT = `You are reading an Indian competitive exam question paper PDF.

EXTRACT: Every English MCQ question that has (a)(b)(c)(d) or (A)(B)(C)(D) options.

RULES:
- Extract the ENGLISH version of each question only
- Each question starts with a number: 1. or Q1. or Q.1
- Each question has exactly 4 options labeled (a)(b)(c)(d)
- If an answer key exists at the end like "1.(b) 2.(c) 3.(d)" — use it to set correct answers (a=0, b=1, c=2, d=3)
- If "Ans.(b)" appears near a question — use it

SKIP COMPLETELY:
- Hindi/Devanagari text below each English question (it is just translation)
- Garbled text like "firk vkSj iq=k orZeku vk;q gSA dk dh" (corrupted Hindi font)
- Cover pages, author names, "Aditya Ranjan", "Physics Wallah", "Join Telegram", phone numbers
- Open-ended questions with no (a)(b)(c)(d) options
- Sub-parts labeled (i)(ii)(iii) — these are not MCQs

PRESERVE: Math expressions exactly — x² + 1/x, a³ - 1/a³, √3, ₹, %

Return ONLY a JSON array, zero markdown, zero explanation:
[{"question":"complete english question?","options":["option a","option b","option c","option d"],"correct":1}]`

  async function callGemini(parts, model) {
    const ctrl = new AbortController()
    const tid  = setTimeout(() => ctrl.abort(), 9000)
    try {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: ctrl.signal,
          body: JSON.stringify({
            contents: [{ parts }],
            generationConfig: { temperature: 0.01, maxOutputTokens: 8192 }
          })
        }
      )
      clearTimeout(tid)
      return { r, status: r.status }
    } catch(e) {
      clearTimeout(tid)
      throw e
    }
  }

  async function tryExtract(parts) {
    for (const model of ['gemini-2.0-flash', 'gemini-1.5-flash-latest', 'gemini-1.5-pro-latest']) {
      try {
        const { r, status } = await callGemini(parts, model)
        if (status === 429) { await new Promise(x => setTimeout(x, 3000)); continue }
        if (status === 403) throw Object.assign(new Error('Invalid API key'), { fatal: true })
        if (!r.ok) { await new Promise(x => setTimeout(x, 1000)); continue }
        const d = await r.json()
        return d?.candidates?.[0]?.content?.parts?.[0]?.text || ''
      } catch(e) {
        if (e.fatal) throw e
        if (e.name === 'AbortError') continue
        console.error(model, e.message)
      }
    }
    return ''
  }

  function parseAndValidate(raw) {
    const clean = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
    let qs = []
    try { const p = JSON.parse(clean); if (Array.isArray(p)) qs = p }
    catch { const m = clean.match(/\[[\s\S]*\]/s); if (m) try { qs = JSON.parse(m[0]) } catch {} }
    const seen = new Set()
    return qs.filter(q => {
      if (!q?.question || q.question.trim().length < 10) return false
      if (!Array.isArray(q.options) || q.options.filter(o => String(o||'').trim()).length < 2) return false
      const k = q.question.slice(0,60).toLowerCase().replace(/\s+/g,'')
      if (seen.has(k)) return false
      seen.add(k); return true
    }).map(q => ({
      question: q.question.trim(),
      options: q.options.map(o => String(o||'').trim()).filter(Boolean).slice(0,4),
      correct: (typeof q.correct==='number' && q.correct>=0 && q.correct<=3) ? q.correct : null
    }))
  }

  try {
    let raw = ''

    // ── MODE 1: Gemini File API — best, send raw PDF bytes ──────────────
    if (body.pdfBase64) {
      const parts = [
        { text: PROMPT },
        { inline_data: { mime_type: 'application/pdf', data: body.pdfBase64 } }
      ]
      raw = await tryExtract(parts)
    }

    // ── MODE 2: Fallback — page images batched 4 at a time ──────────────
    if ((!raw || parseAndValidate(raw).length === 0) && body.images?.length) {
      const BATCH = 4
      const allRaw = []
      for (let i = 0; i < body.images.length; i += BATCH) {
        const batch = body.images.slice(i, i + BATCH)
        const parts = [{ text: PROMPT }]
        for (const img of batch) {
          parts.push({ inline_data: { mime_type: img.mimeType || 'image/jpeg', data: img.base64 } })
        }
        const batchRaw = await tryExtract(parts)
        allRaw.push(batchRaw)
        if (i + BATCH < body.images.length) await new Promise(x => setTimeout(x, 1000))
      }
      raw = allRaw.join('\n')
    }

    // Merge results from potentially multiple JSON arrays in raw
    const allQuestions = []
    const seen = new Set()
    // Find all JSON arrays in raw output and merge
    const matches = raw.match(/\[[\s\S]*?\]/g) || [raw]
    for (const chunk of matches) {
      try {
        const qs = parseAndValidate(chunk.startsWith('[') ? chunk : `[${chunk}]`)
        for (const q of qs) {
          const k = q.question.slice(0,60).toLowerCase().replace(/\s+/g,'')
          if (seen.has(k)) continue
          seen.add(k); allQuestions.push(q)
        }
      } catch {}
    }
    // Also try parsing full raw if above got nothing
    if (allQuestions.length === 0) {
      for (const q of parseAndValidate(raw)) {
        const k = q.question.slice(0,60).toLowerCase().replace(/\s+/g,'')
        if (seen.has(k)) continue
        seen.add(k); allQuestions.push(q)
      }
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questions: allQuestions, mode: body.pdfBase64 ? 'pdf-native' : 'vision' })
    }
  } catch(e) {
    if (e.fatal) return { statusCode: 403, body: JSON.stringify({ keyError: true, error: 'Invalid API key. Check Settings.' }) }
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) }
  }
}
