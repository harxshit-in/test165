exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  let body = {}
  try { body = JSON.parse(event.body || '{}') } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) }
  }

  // User key from body ALWAYS wins — never gets stripped by proxy
  const apiKey = (body.userApiKey || '').trim() || (process.env.GEMINI_API_KEY || '').trim()

  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'No API key. Go to Settings and add your free Gemini key.' })
    }
  }

  // Key test ping — no images sent
  if (!body.images?.length) {
    return { statusCode: 400, body: JSON.stringify({ keyValid: true, error: 'No images' }) }
  }

  const PROMPT = `You are reading one page of an Indian exam question paper.

EXTRACT: Only English MCQ questions that have (a)(b)(c)(d) options.
SKIP: All Hindi text, Devanagari script, garbled text (firk vkSj iq=k orZeku vk;q gSA dk dh), cover pages, author names, Telegram links, phone numbers, open-ended questions with no options.
FORMAT: Question starts with number (1. Q1. etc), has 4 options (a)(b)(c)(d).
ANSWERS: If answer key exists like "1.(b) 2.(c)" or "Ans.(b)" use it — a=0,b=1,c=2,d=3.
MATH: Keep exactly: x²+1/x, √3, a³-1/a³

Return ONLY JSON array (no markdown, no text):
[{"question":"full english question?","options":["option a","option b","option c","option d"],"correct":0}]
No questions found = return: []`

  const all  = []
  const seen = new Set()

  for (const img of body.images) {
    let raw = ''

    for (const model of ['gemini-2.0-flash', 'gemini-1.5-flash-latest']) {
      try {
        const ctrl = new AbortController()
        const tid  = setTimeout(() => ctrl.abort(), 8000)

        const r = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            signal:  ctrl.signal,
            body: JSON.stringify({
              contents: [{ parts: [
                { text: PROMPT },
                { inline_data: { mime_type: img.mimeType || 'image/jpeg', data: img.base64 } }
              ]}],
              generationConfig: { temperature: 0.01, maxOutputTokens: 4096 }
            })
          }
        )
        clearTimeout(tid)

        if (r.status === 429) {
          return {
            statusCode: 429,
            body: JSON.stringify({
              rateLimited: true,
              error: 'Rate limit reached. Go to Settings → add your own free Gemini API key to bypass this.'
            })
          }
        }
        if (r.status === 403) {
          return { statusCode: 403, body: JSON.stringify({ keyError: true, error: 'Invalid API key. Check Settings.' }) }
        }
        if (!r.ok) { await new Promise(x => setTimeout(x, 500)); continue }

        const d = await r.json()
        raw = d?.candidates?.[0]?.content?.parts?.[0]?.text || ''
        break

      } catch (e) {
        if (e.name === 'AbortError') { console.log(`Timeout on ${model}`); continue }
        console.error(e.message)
      }
    }

    if (!raw) continue

    // Parse JSON safely
    const clean = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
    let qs = []
    try { const p = JSON.parse(clean); if (Array.isArray(p)) qs = p }
    catch { const m = clean.match(/\[[\s\S]*\]/); if (m) try { qs = JSON.parse(m[0]) } catch {} }

    for (const q of qs) {
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
