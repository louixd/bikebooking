import { useEffect, useMemo, useState } from 'react'
import HomePage from './pages/HomePage.jsx'
import AdminPage from './pages/AdminPage.jsx'
import { loginEntra, setAuthToken } from './api/bikeflowApi.js'
import { initializeEntraSession, signInWithEntra } from './api/entraAuth.js'

export default function App() {
  const [page, setPage] = useState('home')
  const [currentUser, setCurrentUser] = useState(null)
  const [authError, setAuthError] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [authReady, setAuthReady] = useState(false)

  useEffect(() => {
    let isMounted = true

    async function bootMicrosoftSession() {
      setAuthError(null)
      setAuthLoading(true)
      try {
        const idToken = await initializeEntraSession()
        if (!idToken || !isMounted) return
        setAuthToken(idToken)
        const user = await loginEntra(idToken)
        if (!isMounted) return
        sessionStorage.setItem('bikeflow-current-user', JSON.stringify(user))
        setCurrentUser(user)
        if (user.is_admin) setPage('admin')
        setAuthReady(true)
      } catch (err) {
        if (!isMounted) return
        setAuthError(err.message)
        setAuthReady(false)
      } finally {
        if (isMounted) setAuthLoading(false)
      }
    }

    bootMicrosoftSession()
    return () => {
      isMounted = false
    }
  }, [])

  async function handleMicrosoftLogin() {
    setAuthError(null)
    setAuthLoading(true)
    try {
      await signInWithEntra()
    } catch (err) {
      setAuthError(err.message)
      setAuthLoading(false)
    } finally {
    }
  }

  const authLabel = useMemo(() => {
    if (!currentUser) return 'Connexion Microsoft'
    return `${currentUser.user_name} - ${currentUser.role_name}`
  }, [currentUser])

  if (!authReady || !currentUser) {
    return (
      <div className="auth-gate">
        <div className="auth-gate-panel">
          <div className="app-logo">BikeFlow</div>
          <h1>Connexion Microsoft</h1>
          <p>{authError ? authError : 'Ouverture de session avec votre compte entreprise...'}</p>
          <button className="microsoft-login-btn" onClick={handleMicrosoftLogin} disabled={authLoading && !authError}>
            <span className="microsoft-mark" aria-hidden="true"><i /><i /><i /><i /></span>
            {authLoading && !authError ? 'Connexion...' : 'Se connecter avec Microsoft'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <header className="app-header app-header-vivid">
        <div className="app-logo-block">
          <div className="app-logo">BikeFlow</div>
          <p className="app-subtitle">Flotte velo entreprise, version locale</p>
        </div>
        <nav>
          {currentUser?.is_admin && <button className={page === 'home' ? 'nav-btn active' : 'nav-btn'} onClick={() => setPage('home')}>Reservations</button>}
          {currentUser?.is_admin && <button className={page === 'admin' ? 'nav-btn active' : 'nav-btn'} onClick={() => setPage('admin')}>Administration</button>}
          {currentUser?.is_admin && <button className={page === 'returns' ? 'nav-btn active' : 'nav-btn'} onClick={() => setPage('returns')}>Historique retours</button>}
        </nav>
        <div className="header-actions">
          <div className="local-auth-chip">
            <span className="local-auth-label">{authLabel}</span>
          </div>
        </div>
      </header>
      {authError && <div className="auth-error-banner">{authError} <button onClick={() => setAuthError(null)}>Fermer</button></div>}
      <main className="app-main">
        {page === 'home' && <HomePage currentUser={currentUser} />}
        {page === 'admin' && currentUser?.is_admin && <AdminPage mode="manage" />}
        {page === 'returns' && currentUser?.is_admin && <AdminPage mode="returns" />}
      </main>
    </div>
  )
}
