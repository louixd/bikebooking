import { PublicClientApplication } from '@azure/msal-browser'

const tenantId = import.meta.env.VITE_ENTRA_TENANT_ID
const clientId = import.meta.env.VITE_ENTRA_CLIENT_ID
const authority = import.meta.env.VITE_ENTRA_AUTHORITY || (tenantId ? `https://login.microsoftonline.com/${tenantId}` : null)
const scopes = (import.meta.env.VITE_ENTRA_SCOPES || 'openid profile email').split(' ').filter(Boolean)

let msalInstance = null
let initPromise = null
let startupPromise = null

function getMsalInstance() {
  if (!tenantId || !clientId) {
    throw new Error('Configuration Entra ID manquante: renseigne VITE_ENTRA_TENANT_ID et VITE_ENTRA_CLIENT_ID.')
  }
  if (!msalInstance) {
    msalInstance = new PublicClientApplication({
      auth: {
        clientId,
        authority,
        redirectUri: window.location.origin,
      },
      cache: {
        cacheLocation: 'sessionStorage',
        storeAuthStateInCookie: false,
      },
    })
  }
  return msalInstance
}

async function ensureInitialized(instance) {
  if (!initPromise) initPromise = instance.initialize()
  await initPromise
}

export async function signInWithEntra() {
  const instance = getMsalInstance()
  await ensureInitialized(instance)
  await instance.loginRedirect({ scopes, prompt: 'select_account' })
  return null
}

export async function initializeEntraSession() {
  if (startupPromise) return startupPromise
  startupPromise = (async () => {
    const instance = getMsalInstance()
    await ensureInitialized(instance)

    const redirectResult = await instance.handleRedirectPromise()
    if (redirectResult?.account) {
      instance.setActiveAccount(redirectResult.account)
      return redirectResult.idToken
    }

    const activeAccount = instance.getActiveAccount() || instance.getAllAccounts()[0]
    if (!activeAccount) {
      await instance.loginRedirect({ scopes })
      return null
    }

    instance.setActiveAccount(activeAccount)
    try {
      const result = await instance.acquireTokenSilent({ account: activeAccount, scopes })
      return result.idToken
    } catch {
      await instance.loginRedirect({ scopes })
      return null
    }
  })()
  return startupPromise
}

export async function signOutWithEntra() {
  if (!msalInstance) return
  await ensureInitialized(msalInstance)
  const account = msalInstance.getActiveAccount()
  if (account) await msalInstance.logoutRedirect({ account, postLogoutRedirectUri: window.location.origin })
}