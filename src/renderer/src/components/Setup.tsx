import { useState } from 'react'
import { BookOpen, Lock, Eye, EyeOff, ShieldCheck } from 'lucide-react'
import { useStore } from '../store/useStore'

export default function Setup() {
  const { setIsSetup, setIsAuthenticated, setJournals } = useStore()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const strength = getPasswordStrength(password)

  async function handleSetup(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)
    try {
      const result = await window.api.auth.setup(password)
      if (result.success) {
        const journals = await window.api.journals.list()
        setJournals(journals)
        setIsSetup(true)
        setIsAuthenticated(true)
      } else {
        setError(result.error ?? 'Setup failed')
      }
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-screen bg-gray-950">
      {/* Left branding panel */}
      <div className="hidden lg:flex flex-col justify-between w-[420px] bg-sidebar-bg p-10">
        <div className="flex items-center gap-3">
          <BookOpen className="w-7 h-7 text-blue-400" />
          <span className="text-white font-semibold text-lg tracking-tight">Lumina Journal</span>
        </div>
        <div>
          <h1 className="text-3xl font-bold text-white leading-snug mb-4">
            Your thoughts, <br />
            <span className="text-blue-400">encrypted.</span>
          </h1>
          <p className="text-sidebar-text text-sm leading-relaxed">
            Everything you write is encrypted with AES-256-GCM before being saved. Only your
            password can unlock it.
          </p>
          <div className="mt-8 space-y-3">
            {[
              'End-to-end encryption on every entry',
              'Your key never leaves this device',
              'Multiple journals, one password'
            ].map((f) => (
              <div key={f} className="flex items-center gap-2 text-sidebar-text text-sm">
                <ShieldCheck className="w-4 h-4 text-blue-400 shrink-0" />
                {f}
              </div>
            ))}
          </div>
        </div>
        <div className="text-sidebar-text text-xs opacity-50">v1.0.0</div>
      </div>

      {/* Right setup panel */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <BookOpen className="w-6 h-6 text-blue-400" />
            <span className="text-white font-semibold">Lumina Journal</span>
          </div>

          <h2 className="text-2xl font-bold text-white mb-1">Create your journal</h2>
          <p className="text-gray-400 text-sm mb-8">
            Set a master password to protect all your entries.
          </p>

          <form onSubmit={handleSetup} className="space-y-4">
            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Master Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-10 pr-10 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  placeholder="Choose a strong password"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {/* Strength meter */}
              {password && (
                <div className="mt-2">
                  <div className="flex gap-1 mb-1">
                    {[0, 1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className={`h-1 flex-1 rounded-full transition-colors ${
                          i < strength.score
                            ? strength.score <= 1
                              ? 'bg-red-500'
                              : strength.score <= 2
                                ? 'bg-yellow-500'
                                : strength.score <= 3
                                  ? 'bg-blue-500'
                                  : 'bg-green-500'
                            : 'bg-gray-700'
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-gray-500">{strength.label}</p>
                </div>
              )}
            </div>

            {/* Confirm */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-10 pr-10 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  placeholder="Repeat your password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-900/30 border border-red-800 rounded-lg px-3 py-2.5 text-red-300 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-lg text-sm transition-colors mt-2"
            >
              {loading ? 'Setting up...' : 'Create Journal'}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-gray-600">
            Your password cannot be recovered. Store it somewhere safe.
          </p>
        </div>
      </div>
    </div>
  )
}

function getPasswordStrength(password: string): { score: number; label: string } {
  if (!password) return { score: 0, label: '' }
  let score = 0
  if (password.length >= 8) score++
  if (password.length >= 12) score++
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++
  if (/[0-9]/.test(password) || /[^A-Za-z0-9]/.test(password)) score++
  const labels = ['', 'Weak', 'Fair', 'Good', 'Strong']
  return { score, label: labels[score] || 'Weak' }
}
