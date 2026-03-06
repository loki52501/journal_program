import { useState, useRef, useEffect } from 'react'
import { BookOpen, Lock, Eye, EyeOff } from 'lucide-react'
import { useStore } from '../store/useStore'

export default function Login() {
  const { setIsAuthenticated, setJournals, setTags } = useStore()
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [shake, setShake] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const result = await window.api.auth.login(password)
      if (result.success) {
        const [journals, tags] = await Promise.all([
          window.api.journals.list(),
          window.api.tags.all()
        ])
        setJournals(journals)
        setTags(tags)
        setIsAuthenticated(true)
      } else {
        setError('Incorrect password. Please try again.')
        setShake(true)
        setTimeout(() => setShake(false), 500)
        setPassword('')
        inputRef.current?.focus()
      }
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-screen items-center justify-center bg-gray-950">
      <div className={`w-full max-w-xs ${shake ? 'animate-shake' : ''}`}>
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-blue-900/40">
            <BookOpen className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-white font-bold text-xl">Lumina Journal</h1>
          <p className="text-gray-500 text-sm mt-1">Enter your password to unlock</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-3">
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              ref={inputRef}
              type={showPw ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-10 pr-10 py-3 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              placeholder="Master password"
            />
            <button
              type="button"
              onClick={() => setShowPw(!showPw)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
              tabIndex={-1}
            >
              {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {error && <p className="text-red-400 text-xs text-center">{error}</p>}

          <button
            type="submit"
            disabled={loading || !password}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-lg text-sm transition-colors"
          >
            {loading ? 'Unlocking...' : 'Unlock Journal'}
          </button>
        </form>
      </div>
    </div>
  )
}
