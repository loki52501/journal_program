import { useEffect, useState } from 'react'
import { useStore } from './store/useStore'
import Login from './components/Login'
import Setup from './components/Setup'
import Layout from './components/Layout'

export default function App() {
  const { isSetup, isAuthenticated, setIsSetup, setIsAuthenticated } = useStore()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    async function check() {
      const setup = await window.api.auth.isSetup()
      setIsSetup(setup)
      if (setup) {
        const active = await window.api.auth.isSessionActive()
        setIsAuthenticated(active)
      }
      setChecking(false)
    }
    check()
  }, [])

  if (checking) {
    return (
      <div className="flex h-screen items-center justify-center bg-sidebar-bg">
        <div className="text-sidebar-text opacity-50 text-sm">Loading...</div>
      </div>
    )
  }

  if (!isSetup) return <Setup />
  if (!isAuthenticated) return <Login />
  return <Layout />
}
