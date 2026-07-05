import { useState, useRef, useEffect } from 'react'
import { askQuestion } from '../api/floodData.js'
import { Send, Bot, User, CornerDownLeft, Sparkles } from 'lucide-react'

export default function AIAssistant() {
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      sender: 'bot',
      text: 'Hello! I am your Rasta Radar AI Assistant. Ask me about current waterlogging hotspots, route risk assessments, or safety advisories in Mumbai.',
    },
  ])
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef(null)

  const quickPrompts = [
    'Is Andheri Subway passable right now?',
    'Compare safety of WEH vs EEH',
    'Explain Sion Circle flood risk',
    'What should I check before leaving during high tide?',
  ]

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, loading])

  const handleSend = async (textToSend) => {
    const text = textToSend || input
    if (!text.trim()) return

    const userMsg = {
      id: Math.random().toString(),
      sender: 'user',
      text: text,
    }
    setMessages((prev) => [...prev, userMsg])
    if (!textToSend) setInput('')

    setLoading(true)

    try {
      const response = await askQuestion(text)
      const botMsg = {
        id: Math.random().toString(),
        sender: 'bot',
        text: response.answer,
      }
      setMessages((prev) => [...prev, botMsg])
    } catch (err) {
      const errorMsg = {
        id: Math.random().toString(),
        sender: 'bot',
        text: 'Sorry, I am unable to connect to the Gemini service right now. Please check if your GEMINI_API_KEY environment variable is configured in the backend.',
      }
      setMessages((prev) => [...prev, errorMsg])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="ai-assistant-page">
      <div className="ai-assistant-container glassmorphic">
        {/* Header */}
        <div className="ai-assistant-header">
          <div className="bot-avatar-wrap">
            <Bot size={22} className="text-teal" />
          </div>
          <div className="ai-header-info">
            <h2>AI Flood Assistant</h2>
            <p className="status-online">
              <span className="dot"></span> Online — Powered by Gemini 1.5 Flash
            </p>
          </div>
        </div>

        {/* Messages stream */}
        <div className="chat-stream">
          {messages.map((msg) => (
            <div key={msg.id} className={`chat-bubble-wrap ${msg.sender}`}>
              <div className="bubble-avatar">
                {msg.sender === 'bot' ? <Bot size={14} /> : <User size={14} />}
              </div>
              <div className="chat-bubble">
                <p className="bubble-text">{msg.text}</p>
              </div>
            </div>
          ))}
          {loading && (
            <div className="chat-bubble-wrap bot">
              <div className="bubble-avatar">
                <Bot size={14} />
              </div>
              <div className="chat-bubble loading">
                <span className="dot"></span>
                <span className="dot"></span>
                <span className="dot"></span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick prompts */}
        {messages.length === 1 && (
          <div className="quick-prompts-container">
            <p className="quick-prompts-title">
              <Sparkles size={13} style={{ marginRight: 6 }} /> Suggestion prompts:
            </p>
            <div className="quick-prompts-grid">
              {quickPrompts.map((prompt, idx) => (
                <button
                  key={idx}
                  className="quick-prompt-card"
                  onClick={() => handleSend(prompt)}
                  disabled={loading}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input box */}
        <form
          className="chat-input-form"
          onSubmit={(e) => {
            e.preventDefault()
            handleSend()
          }}
        >
          <input
            type="text"
            className="chat-input-box"
            placeholder="Ask about waterlogging, alternative routes, safety instructions..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
          />
          <button type="submit" className="chat-send-btn" disabled={loading || !input.trim()}>
            <Send size={15} />
          </button>
        </form>
      </div>
    </div>
  )
}
