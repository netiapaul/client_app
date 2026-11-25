// Single choke-point for the auth session (token + user id/name).

const TOKEN_KEY = 'accessToken'
const ID_KEY = 'ID'
const NAME_KEY = 'name'
const CAN_APPROVE_KEY = 'canApprove'
const MODULES_KEY = 'modules'
// Client portal session. `portal` decides which layout and routes the app serves.
const PORTAL_KEY = 'portal'
const CUSCODE_KEY = 'primaryCusCode'

export const getToken = () => localStorage.getItem(TOKEN_KEY)
export const getId = () => localStorage.getItem(ID_KEY)
export const getName = () => localStorage.getItem(NAME_KEY)
export const getCanApprove = () => localStorage.getItem(CAN_APPROVE_KEY) === 'true'

// The module codes this user is allowed (union across their access groups; everything for admins).
export const getModules = () => {
  const raw = localStorage.getItem(MODULES_KEY)
  if (!raw) return []
  return raw
    .split(',')
    .map((c) => Number(c))
    .filter((c) => !Number.isNaN(c))
}
// Permission check used to gate menus, routes, and buttons.
export const hasModule = (code) => !isPortalUser() && getModules().includes(Number(code))

/** True when this session belongs to a customer rather than internal staff. */
export const isPortalUser = () => localStorage.getItem(PORTAL_KEY) === 'true'

/** The company the portal opens on; null when the account has no companies linked yet. */
export const getPrimaryCusCode = () => localStorage.getItem(CUSCODE_KEY) || null

export const setSession = ({ token, id, name, canApprove, modules, portal, primaryCusCode }) => {
  if (token !== undefined) localStorage.setItem(TOKEN_KEY, token)
  if (id !== undefined) localStorage.setItem(ID_KEY, id)
  if (name !== undefined) localStorage.setItem(NAME_KEY, name)
  if (canApprove !== undefined) localStorage.setItem(CAN_APPROVE_KEY, canApprove ? 'true' : 'false')
  if (modules !== undefined) localStorage.setItem(MODULES_KEY, (modules || []).join(','))
  if (portal !== undefined) localStorage.setItem(PORTAL_KEY, portal ? 'true' : 'false')
  if (primaryCusCode !== undefined) localStorage.setItem(CUSCODE_KEY, primaryCusCode || '')
}

// Clears only the session keys (unlike localStorage.clear(), this leaves e.g. the theme preference).
export const clearSession = () => {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(ID_KEY)
  localStorage.removeItem(NAME_KEY)
  localStorage.removeItem(CAN_APPROVE_KEY)
  localStorage.removeItem(MODULES_KEY)
  localStorage.removeItem(PORTAL_KEY)
  localStorage.removeItem(CUSCODE_KEY)
}

export const isAuthenticated = () => Boolean(getToken() && getId() && getName())

// Convenience for the axios Authorization header.
export const authHeader = () => ({ Authorization: `Bearer ${getToken()}` })
