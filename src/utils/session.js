// Single choke-point for the auth session (token + user id/name). Every screen reads/writes the
// session through here instead of touching localStorage directly, so a future change to where the
// token lives (e.g. httpOnly cookies) is a one-file edit rather than a ~17-file sweep.

const TOKEN_KEY = 'accessToken'
const ID_KEY = 'ID'
const NAME_KEY = 'name'
const CAN_APPROVE_KEY = 'canApprove'
const MODULES_KEY = 'modules'

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
export const hasModule = (code) => getModules().includes(Number(code))

export const setSession = ({ token, id, name, canApprove, modules }) => {
  if (token !== undefined) localStorage.setItem(TOKEN_KEY, token)
  if (id !== undefined) localStorage.setItem(ID_KEY, id)
  if (name !== undefined) localStorage.setItem(NAME_KEY, name)
  if (canApprove !== undefined) localStorage.setItem(CAN_APPROVE_KEY, canApprove ? 'true' : 'false')
  if (modules !== undefined) localStorage.setItem(MODULES_KEY, (modules || []).join(','))
}

// Clears only the session keys (unlike localStorage.clear(), this leaves e.g. the theme preference).
export const clearSession = () => {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(ID_KEY)
  localStorage.removeItem(NAME_KEY)
  localStorage.removeItem(CAN_APPROVE_KEY)
  localStorage.removeItem(MODULES_KEY)
}

export const isAuthenticated = () => Boolean(getToken() && getId() && getName())

// Convenience for the axios Authorization header.
export const authHeader = () => ({ Authorization: `Bearer ${getToken()}` })
