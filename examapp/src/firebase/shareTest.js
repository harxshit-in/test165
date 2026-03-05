import { db } from './firebaseConfig'
import { doc, setDoc, getDoc, collection } from 'firebase/firestore'

export async function shareTest(testConfig) {
  if (!db) throw new Error('Firebase not configured')
  const ref = doc(collection(db, 'shared_tests'))
  const shareData = {
    id: ref.id,
    name: testConfig.name,
    timeLimit: testConfig.timeLimit,
    questions: testConfig.questions.map(q => ({
      id: q.id,
      question: q.question,
      options: q.options,
      correct: q.correct ?? null,
    })),
    createdAt: Date.now(),
    attempts: 0,
  }
  await setDoc(ref, shareData)
  return ref.id
}

export async function loadSharedTest(testId) {
  if (!db) throw new Error('Firebase not configured')
  const snap = await getDoc(doc(db, 'shared_tests', testId))
  if (!snap.exists()) throw new Error('Test not found')
  return snap.data()
}
