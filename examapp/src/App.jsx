import React from 'react'
import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import Upload from './pages/Upload'
import QuestionBankPage from './pages/QuestionBank'
import TestGeneratorPage from './pages/TestGenerator'
import TestPage from './pages/Test'
import ResultPage from './pages/Result'
import SharedTestPage from './pages/SharedTest'
import OMRScanPage from './pages/OMRScan'
import Settings from './pages/Settings'
import Layout from './components/Layout'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="upload" element={<Upload />} />
        <Route path="bank/:bankId" element={<QuestionBankPage />} />
        <Route path="bank/:bankId/tests" element={<TestGeneratorPage />} />
        <Route path="omr" element={<OMRScanPage />} />
        <Route path="settings" element={<Settings />} />
      </Route>
      <Route path="/test/:testId" element={<TestPage />} />
      <Route path="/result/:testId" element={<ResultPage />} />
      <Route path="/shared" element={<SharedTestPage />} />
    </Routes>
  )
}
