// Single choke-point for the auth session (token + user id/name). Every screen reads/writes the
// session through here instead of touching localStorage directly, so a future change to where the
// token lives (e.g. httpOnly cookies) is a one-file edit rather than a ~17-file sweep.

const TOKEN_KEY = 'accessToken'
const ID_KEY = 'ID'
const NAME_KEY = 'name'
const CAN_APPROVE_KEY = 'canApprove'

export const getToken = () => localStorage.getItem(TOKEN_KEY)
export const getId = () => localStorage.getItem(ID_KEY)
export const getName = () => localStorage.getItem(NAME_KEY)
export const getCanApprove = () => localStorage.getItem(CAN_APPROVE_KEY) === 'true'

export const setSession = ({ token, id, name, canApprove }) => {
  if (token !== undefined) localStorage.setItem(TOKEN_KEY, token)
  if (id !== undefined) localStorage.setItem(ID_KEY, id)
  if (name !== undefined) localStorage.setItem(NAME_KEY, name)
  if (canApprove !== undefined) localStorage.setItem(CAN_APPROVE_KEY, canApprove ? 'true' : 'false')
}

// Clears only the session keys (unlike localStorage.clear(), this leaves e.g. the theme preference).
export const clearSession = () => {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(ID_KEY)
  localStorage.removeItem(NAME_KEY)
  localStorage.removeItem(CAN_APPROVE_KEY)
}

export const isAuthenticated = () => Boolean(getToken() && getId() && getName())

// Convenience for the axios Authorization header.
export const authHeader = () => ({ Authorization: `Bearer ${getToken()}` })
