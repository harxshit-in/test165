/**
 * Smart Question Parser — works on ANY MCQ PDF format
 * No fixed format required. Uses layered heuristics.
 */

function clean(str) {
  return str
    .replace(/\s+/g, ' ')
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
    .replace(/\u00a0/g, ' ')
    .trim()
}

const OPTION_RE = /^[\s]*[\[(]?([A-Ea-e])[\])]?[.\s)]\s*(.+)/
const QUESTION_RE = /^[\s]*(?:Q\.?\s*)?(\d{1,3})[.):\s]\s*(.{5,})/i
const ANS_RE = /^[\s]*(?:ans(?:wer)?|key|correct|sol(?:ution)?)[\s:.*]*[\[(]?([A-Ea-e])[\])]?/i

function matchOption(line) {
  const m = line.match(OPTION_RE)
  if (!m) return null
  if (/^\d/.test(line.trim())) return null
  return { letter: m[1].toUpperCase(), text: clean(m[2]) }
}

function matchQuestion(line) {
  const m = line.match(QUESTION_RE)
  if (!m) return null
  return { num: parseInt(m[1]), text: clean(m[2]) }
}

function matchAnswerHint(line) {
  const m = line.match(ANS_RE)
  return m ? m[1].toUpperCase() : null
}

export function parseQuestions(rawText) {
  const lines = rawText.split('\n').map(clean).filter(l => l.length > 1)
  const questions = []
  let current = null
  let lastOptionLetter = null

  function pushCurrent() {
    if (!current) return
    if (current.options.length < 2) return
    questions.push(buildQuestion(current))
    current = null
    lastOptionLetter = null
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    const ansHint = matchAnswerHint(line)
    if (ansHint && current) {
      current.answerHint = ansHint
      continue
    }

    const qm = matchQuestion(line)
    if (qm) {
      const isNewQ = !current || qm.num !== current.num
      if (isNewQ) {
        pushCurrent()
        current = { num: qm.num, question: qm.text, options: [], answerHint: null }
        lastOptionLetter = null
        continue
      }
    }

    const om = matchOption(line)
    if (om && current) {
      if (!current.options.find(o => o.letter === om.letter)) {
        current.options.push(om)
        lastOptionLetter = om.letter
      }
      continue
    }

    if (current) {
      const isLikelyContent = line.length > 3 && !/^\d{1,3}[.)]\s/.test(line)
      if (lastOptionLetter && current.options.length > 0 && isLikelyContent) {
        const last = current.options[current.options.length - 1]
        last.text = clean(last.text + ' ' + line)
      } else if (!lastOptionLetter && isLikelyContent) {
        current.question = clean(current.question + ' ' + line)
      }
    }
  }
  pushCurrent()

  // If primary parser found nothing, try fallback
  const primary = deduplicateAndRenumber(questions)
  if (primary.length === 0) return fallbackParse(rawText)
  return primary
}

function buildQuestion(raw) {
  const LETTERS = ['A', 'B', 'C', 'D', 'E']
  const sorted = [...raw.options].sort((a, b) => LETTERS.indexOf(a.letter) - LETTERS.indexOf(b.letter))
  let correct = null
  if (raw.answerHint) {
    const idx = LETTERS.indexOf(raw.answerHint)
    if (idx !== -1 && idx < sorted.length) correct = idx
  }
  return {
    id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    question: raw.question,
    options: sorted.map(o => o.text),
    correct,
  }
}

function deduplicateAndRenumber(questions) {
  const seen = new Set()
  return questions.filter(q => {
    const key = q.question.slice(0, 60).toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return q.question.length > 5 && q.options.length >= 2
  })
}

export function fallbackParse(rawText) {
  const chunks = rawText.split(/(?=\b\d{1,3}[.)]\s)/)
  const results = []
  for (const chunk of chunks) {
    const lines = chunk.split('\n').map(clean).filter(Boolean)
    if (lines.length < 3) continue
    const questionLine = lines[0].replace(/^\d{1,3}[.)]\s*/, '').trim()
    if (questionLine.length < 5) continue
    const optionLines = lines.slice(1).filter(l => /^[A-Da-d][.)]/i.test(l))
    if (optionLines.length < 2) continue
    results.push({
      id: `q_fb_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      question: questionLine,
      options: optionLines.map(l => l.replace(/^[A-Da-d][.)]\s*/i, '').trim()),
      correct: null,
    })
  }
  return results
}

export function generateBankId(filename) {
  const base = filename.replace(/\.pdf$/i, '').replace(/[^a-zA-Z0-9]/g, '_').toLowerCase().slice(0, 40)
  return `${base}_${Date.now()}`
}
