import { useEffect, useMemo, useState } from 'react'
import HomePage from './pages/HomePage.jsx'
import AdminPage from './pages/AdminPage.jsx'
import { loginLocal } from './api/bikeflowApi.js'

const EMPTY_LOGIN = { email: '', password: '' }

function AuthModal({ onClose, onSuccess }) {
  const [loginForm, setLoginForm] = useState(EMPTY_LOGIN)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  async function handleLogin(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const user = await loginLocal(loginForm)
      onSuccess(user)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal auth-modal">
        <form onSubmit={handleLogin}>
          <h2>Connexion locale</h2>
          <p className="modal-info">Connexion reservee aux comptes deja crees, notamment l'administration.</p>
          <label htmlFor="login-email">Email</label>
          <input id="login-email" type="email" value={loginForm.email} onChange={(e) => setLoginForm((prev) => ({ ...prev, email: e.target.value }))} required />
          <label htmlFor="login-password">Mot de passe</label>
          <input id="login-password" type="password" value={loginForm.password} onChange={(e) => setLoginForm((prev) => ({ ...prev, password: e.target.value }))} required />
          {error && <p className="form-error">{error}</p>}
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Fermer</button>
            <button type="submit" className="btn-primary" disabled={loading}>{loading ? 'Connexion...' : 'Se connecter'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function App() {
  const [page, setPage] = useState('home')
  const [currentUser, setCurrentUser] = useState(null)
  const [authModalMode, setAuthModalMode] = useState(null)

  useEffect(() => {
    const raw = sessionStorage.getItem('bikeflow-current-user')
    if (raw) {
      try {
        setCurrentUser(JSON.parse(raw))
      } catch {
        sessionStorage.removeItem('bikeflow-current-user')
      }
    }
  }, [])

  function handleAuthSuccess(user) {
    sessionStorage.setItem('bikeflow-current-user', JSON.stringify(user))
    setCurrentUser(user)
    setAuthModalMode(null)
    if (user.is_admin && page !== 'admin' && page !== 'returns') {
      setPage('admin')
    }
  }

  function handleLogout() {
    sessionStorage.removeItem('bikeflow-current-user')
    setCurrentUser(null)
    setPage('home')
  }

  const authLabel = useMemo(() => {
    if (!currentUser) return 'Connexion locale'
    return `${currentUser.user_name} - ${currentUser.role_name}`
  }, [currentUser])

  return (
    <div>
      <header className="app-header app-header-vivid">
        <div className="app-logo-block">
          <div className="app-logo">BikeFlow</div>
          <p className="app-subtitle">Flotte velo entreprise, version locale</p>
        </div>
        <nav>
          <button className={page === 'home' ? 'nav-btn active' : 'nav-btn'} onClick={() => setPage('home')}>Reservations</button>
          {currentUser?.is_admin && <button className={page === 'admin' ? 'nav-btn active' : 'nav-btn'} onClick={() => setPage('admin')}>Administration</button>}
          {currentUser?.is_admin && <button className={page === 'returns' ? 'nav-btn active' : 'nav-btn'} onClick={() => setPage('returns')}>Retours</button>}
        </nav>
        <div className="header-actions">
          <div className="local-auth-chip">
            <span className="local-auth-label">{authLabel}</span>
            {currentUser ? (
              <button className="nav-btn" onClick={handleLogout}>Se deconnecter</button>
            ) : (
              <button className="nav-btn" onClick={() => setAuthModalMode('login')}>Connexion admin</button>
            )}
          </div>
        </div>
      </header>
      <main className="app-main">
        {page === 'home' && <HomePage currentUser={currentUser} onRequireAuth={setAuthModalMode} />}
        {page === 'admin' && currentUser?.is_admin && <AdminPage mode="manage" />}
        {page === 'returns' && currentUser?.is_admin && <AdminPage mode="returns" />}
      </main>
      {authModalMode && <AuthModal onClose={() => setAuthModalMode(null)} onSuccess={handleAuthSuccess} />}
    </div>
  )
}
