import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Lock, Mail, User, ArrowRight, ShieldCheck } from 'lucide-react'

export default function Auth() {
  const navigate = useNavigate()
  const location = useLocation()
  
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  
  const from = location.state?.from?.pathname || '/'

  const handleSubmit = (e) => {
    e.preventDefault()
    setError('')
    
    if (!email || !password) {
      setError('Please fill in all fields.')
      return
    }
    
    if (isSignUp && !name) {
      setError('Please provide your name.')
      return
    }

    setLoading(true)
    
    // Simulate Firebase delay
    setTimeout(() => {
      setLoading(false)
      const token = 'mock-firebase-token-' + Math.random().toString(36).substr(2, 9)
      
      localStorage.setItem('rasta_auth_token', token)
      localStorage.setItem('rasta_user_email', email)
      localStorage.setItem('rasta_user_name', isSignUp ? name : email.split('@')[0])
      
      // Dispatch storage event to notify App.jsx shell
      window.dispatchEvent(new Event('storage'))
      
      navigate(from, { replace: true })
    }, 1000)
  }

  return (
    <div className="auth-page-container">
      <div className="auth-card glassmorphic">
        <div className="auth-header">
          <div className="auth-logo-icon">
            <ShieldCheck size={28} className="text-teal" />
          </div>
          <h1>{isSignUp ? 'Create Account' : 'Welcome Back'}</h1>
          <p className="auth-subtitle">
            {isSignUp ? 'Sign up to report local flood alerts' : 'Sign in to access community reporting tools'}
          </p>
        </div>

        {error && (
          <div className="auth-error-banner">
            <span>{error}</span>
          </div>
        )}

        <form className="auth-form" onSubmit={handleSubmit}>
          {isSignUp && (
            <div className="auth-input-group">
              <label htmlFor="name">Full Name</label>
              <div className="auth-input-wrapper">
                <User size={16} className="auth-icon" />
                <input
                  id="name"
                  type="text"
                  placeholder="Moiz Mulla"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={loading}
                  className="auth-input"
                />
              </div>
            </div>
          )}

          <div className="auth-input-group">
            <label htmlFor="email">Email Address</label>
            <div className="auth-input-wrapper">
              <Mail size={16} className="auth-icon" />
              <input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                className="auth-input"
              />
            </div>
          </div>

          <div className="auth-input-group">
            <label htmlFor="password">Password</label>
            <div className="auth-input-wrapper">
              <Lock size={16} className="auth-icon" />
              <input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                className="auth-input"
              />
            </div>
          </div>

          <button type="submit" className="auth-btn" disabled={loading}>
            {loading ? (
              <span className="auth-spinner"></span>
            ) : (
              <>
                <span>{isSignUp ? 'Register Account' : 'Sign In'}</span>
                <ArrowRight size={15} />
              </>
            )}
          </button>
        </form>

        <div className="auth-footer">
          <p>
            {isSignUp ? 'Already have an account?' : "Don't have an account yet?"}{' '}
            <button
              type="button"
              className="auth-switch-btn"
              onClick={() => {
                setIsSignUp(!isSignUp)
                setError('')
              }}
              disabled={loading}
            >
              {isSignUp ? 'Sign In' : 'Sign Up'}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
