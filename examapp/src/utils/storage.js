import { openDB } from 'idb'

const DB_NAME = 'examprep_db'
const DB_VERSION = 2

async function getDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('banks')) {
        db.createObjectStore('banks', { keyPath: 'bankId' })
      }
      if (!db.objectStoreNames.contains('tests')) {
        db.createObjectStore('tests', { keyPath: 'testId' })
      }
      if (!db.objectStoreNames.contains('progress')) {
        db.createObjectStore('progress', { keyPath: 'testId' })
      }
      if (!db.objectStoreNames.contains('results')) {
        db.createObjectStore('results', { keyPath: 'testId' })
      }
    },
  })
}

// --- BANKS ---
export async function saveBank(bank) {
  const db = await getDB()
  await db.put('banks', { ...bank, updatedAt: Date.now() })
}

export async function getAllBanks() {
  const db = await getDB()
  return db.getAll('banks')
}

export async function getBank(bankId) {
  const db = await getDB()
  return db.get('banks', bankId)
}

export async function deleteBank(bankId) {
  const db = await getDB()
  await db.delete('banks', bankId)
}

export async function updateBankQuestions(bankId, questions) {
  const db = await getDB()
  const bank = await db.get('banks', bankId)
  if (bank) {
    bank.questions = questions
    bank.updatedAt = Date.now()
    await db.put('banks', bank)
  }
}

// --- TESTS ---
export async function saveTest(test) {
  const db = await getDB()
  await db.put('tests', { ...test, updatedAt: Date.now() })
}

export async function getTestsByBank(bankId) {
  const db = await getDB()
  const all = await db.getAll('tests')
  return all.filter(t => t.bankId === bankId)
}

export async function getTest(testId) {
  const db = await getDB()
  return db.get('tests', testId)
}

export async function deleteTest(testId) {
  const db = await getDB()
  await db.delete('tests', testId)
  await db.delete('progress', testId)
}

// --- PROGRESS ---
export async function saveProgress(testId, progress) {
  const db = await getDB()
  await db.put('progress', { testId, ...progress, savedAt: Date.now() })
}

export async function getProgress(testId) {
  const db = await getDB()
  return db.get('progress', testId)
}

export async function clearProgress(testId) {
  const db = await getDB()
  await db.delete('progress', testId)
}

// --- RESULTS ---
export async function saveResult(testId, result) {
  const db = await getDB()
  await db.put('results', { testId, ...result, completedAt: Date.now() })
}

export async function getResult(testId) {
  const db = await getDB()
  return db.get('results', testId)
}

export async function getAllResults() {
  const db = await getDB()
  return db.getAll('results')
}
