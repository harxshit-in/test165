// Netlify Serverless Function — identical logic to Vercel but Netlify format
// Deploy: netlify deploy --prod
// Env var: GEMINI_API_KEY in Netlify → Site Settings → Environment Variables

exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  const apiKey = event.headers['x-user-api-key'] || process.env.GEMINI_API_KEY
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'No API key configured.' }) }
  }

  async function callGemini(parts, model = 'gemini-2.0-flash') {
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
    if (!r.ok) {
      const e = await r.json().catch(() => ({}))
      throw Object.assign(new Error(e?.error?.message || `HTTP ${r.status}`), { status: r.status })
    }
    const d = await r.json()
    return d?.candidates?.[0]?.content?.parts?.[0]?.text || ''
  }

  async function tryModels(parts) {
    const models = ['gemini-2.0-flash', 'gemini-1.5-flash-latest', 'gemini-1.5-pro-latest']
    for (const model of models) {
      try { return await callGemini(parts, model) }
      catch (e) {
        if (e.status === 400 || e.status === 403) throw e
        await new Promise(x => setTimeout(x, 1000))
      }
    }
    throw new Error('All Gemini models failed')
  }

  function parseJSON(raw) {
    const c = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
    try { const r = JSON.parse(c); if (Array.isArray(r)) return r } catch {}
    const m = c.match(/\[[\s\S]*?\]/)
    if (m) { try { const r = JSON.parse(m[0]); if (Array.isArray(r)) return r } catch {} }
    return []
  }

  function validate(qs) {
    const seen = new Set()
    return qs.filter(q => {
      if (!q?.question || q.question.trim().length < 10) return false
      if (!Array.isArray(q.options)) return false
      if (q.options.filter(o => String(o||'').trim().length > 0).length < 2) return false
      const k = q.question.slice(0,60).toLowerCase().replace(/\s+/g,'')
      if (seen.has(k)) return false
      seen.add(k); return true
    }).map(q => ({
      question: q.question.trim(),
      options: q.options.map(o => String(o||'').trim()).filter(Boolean).slice(0,4),
      correct: (typeof q.correct==='number' && q.correct>=0 && q.correct<=3) ? q.correct : null
    }))
  }

  const VISION_PROMPT = `You are analyzing a page from an Indian competitive exam question paper.

STEP 1 — LANGUAGE FILTER:
This page has text in English AND Hindi (or garbled Hindi like "firk vkSj" "orZeku vk;q" "iq=k dh").
→ READ ONLY THE ENGLISH TEXT. Completely ignore all Hindi text and all garbled/encoded Hindi characters.
→ Hindi text appears as Devanagari script OR as random-looking English letters (Kruti Dev font corruption).

STEP 2 — IDENTIFY QUESTIONS:
A question is English text that:
- Starts with a number: 1. or Q1. or Q.1 or just "1."
- Is a complete sentence asking something or presenting a mathematical condition
- Is followed by options (a)(b)(c)(d) or (A)(B)(C)(D)

STEP 3 — EXTRACT OPTIONS:
Each question has exactly 4 options labeled (a)(b)(c)(d) or (A)(B)(C)(D).
- Extract the complete text of each option
- Options may be on same line or separate lines
- For math questions options look like: (a) 45  (b) 35  (c) 40  (d) 30
- For age/word problems options look like: (a) 100  (b) 70  (c) 140  (d) 160

STEP 4 — CORRECT ANSWER:
- If answer key visible near question: "Ans.(b)" or "Answer: c" → set correct (a=0,b=1,c=2,d=3)
- If answer key block at page bottom: "1.(b) 2.(c) 3.(d)..." → use it for all questions on page
- Otherwise set correct to null

STEP 5 — STRICT SKIP RULES (do NOT extract these):
✗ Any line containing Hindi/Devanagari script
✗ Garbled text like "firk", "vkSj", "iq=k", "orZeku", "vk;q", "gSA", "dh", "dk"
✗ Cover pages, title pages
✗ Author names: "Aditya Ranjan", "Physics Wallah", "PW"
✗ Social media: "Join Telegram", "Scan Code", phone numbers
✗ Section headings with no options after them
✗ Open-ended questions with no options (like "Find (i) x² + 1/x²")
✗ Sub-parts (i)(ii)(iii) — not MCQs

STEP 6 — MATH EXPRESSIONS:
Preserve exactly: x² + 1/x = 3, a⁴ + 1/a⁴, x³ - 1/x³, √3, etc.

OUTPUT: Return ONLY a JSON array. Zero other text. Zero markdown.
[{"question":"Complete English question text?","options":["option a","option b","option c","option d"],"correct":1}]
If page has NO valid English MCQ questions, return exactly: []`

  try {
    const body = JSON.parse(event.body || '{}')
    const { images } = body

    if (!images?.length) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Send images[]' }) }
    }

    const all = []
    const seen = new Set()

    for (const img of images) {
      try {
        const raw = await tryModels([
          { text: VISION_PROMPT },
          { inline_data: { mime_type: img.mimeType || 'image/jpeg', data: img.base64 } }
        ])
        for (const q of validate(parseJSON(raw))) {
          const k = q.question.slice(0,60).toLowerCase().replace(/\s+/g,'')
          if (seen.has(k)) continue
          seen.add(k)
          all.push(q)
        }
      } catch (e) {
        console.error('Page failed:', e.message)
        if (e.status === 403) throw e
      }
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questions: all, mode: 'vision' })
    }

  } catch (err) {
    if (err.status === 429) return {
      statusCode: 429,
      body: JSON.stringify({ error: 'Rate limit reached. Add your own API key in Settings.', rateLimited: true })
    }
    if (err.status === 403) return {
      statusCode: 403,
      body: JSON.stringify({ error: 'Invalid API key.', keyError: true })
    }
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) }
  }
}
