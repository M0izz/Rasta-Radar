import { useState } from 'react'
import { askQuestion } from '../api/floodData.js'

export default function AskBar({ disabled }) {
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleAskSubmit(e) {
    e.preventDefault()
    if (!question.trim()) return

    setLoading(true)
    setAnswer(null)
    setError(null)

    try {
      const data = await askQuestion(question)
      setAnswer(data.answer)
    } catch {
      setError('Could not reach the server. Check that the backend is running.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="ask-bar-wrap">
      <div className="ask-bar-label">
        Ask about conditions <span>AI</span>
      </div>
      <form className="ask-bar-form" onSubmit={handleAskSubmit}>
        <input
          className="ask-bar-input"
          type="text"
          placeholder="Is Hindmata passable? Which route is safer?"
          value={question}
          onChange={e => setQuestion(e.target.value)}
          disabled={loading || disabled}
        />
        <button className="ask-bar-btn" type="submit" disabled={loading || disabled || !question.trim()}>
          {loading ? '…' : 'Ask'}
        </button>
      </form>
      {answer && (
        <div className="ask-bar-answer">{answer}</div>
      )}
      {error && (
        <div className="error-msg" style={{ marginTop: 8 }}>{error}</div>
      )}
    </div>
  )
}
