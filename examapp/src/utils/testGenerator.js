export function generateTest(bank, config) {
  const { name, questionCount, timeLimit, randomOrder, chapterFilter } = config

  let pool = [...bank.questions]

  if (chapterFilter && chapterFilter.length > 0) {
    pool = pool.filter(q => chapterFilter.includes(q.chapter))
  }

  if (randomOrder) {
    pool = shuffleArray(pool)
  }

  const selected = pool.slice(0, Math.min(questionCount, pool.length))

  return {
    testId: `test_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    bankId: bank.bankId,
    name,
    timeLimit: timeLimit * 60, // convert to seconds
    questionCount: selected.length,
    questions: selected,
    createdAt: Date.now(),
    config,
  }
}

function shuffleArray(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function calculateResult(test, answers) {
  let correct = 0, incorrect = 0, skipped = 0
  const details = []

  for (const q of test.questions) {
    const ans = answers[q.id]
    const isSkipped = ans === undefined || ans === null
    const isCorrect = !isSkipped && q.correct !== null && ans === q.correct

    if (isSkipped) skipped++
    else if (isCorrect) correct++
    else incorrect++

    details.push({
      id: q.id,
      question: q.question,
      options: q.options,
      correct: q.correct,
      selected: ans ?? null,
      status: isSkipped ? 'skipped' : isCorrect ? 'correct' : 'incorrect',
    })
  }

  const total = test.questions.length
  const score = correct
  const maxScore = total
  const percentage = total > 0 ? Math.round((score / maxScore) * 100) : 0

  return { correct, incorrect, skipped, total, score, maxScore, percentage, details }
}
