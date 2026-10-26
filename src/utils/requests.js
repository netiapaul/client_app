import { ServiceInstance } from './AxiosInstance'
import API_PATHS from './API_paths'
const API_URL = process.env.REACT_APP_URL_CONFIG

// Auth
export const loginRequest = async (userData) =>
  await ServiceInstance()
    .post(`${API_URL}${API_PATHS.login}`, {
      email: userData.email,
      password: userData.password,
    })
    .then((data) => data.data)

// Second login step for 2FA accounts: exchange the pending token + code for an access token.
export const loginTwoFactorRequest = async ({ twoFactorToken, code }) =>
  await ServiceInstance()
    .post(`${API_URL}${API_PATHS.loginTwoFactor}`, { twoFactorToken, code })
    .then((data) => data.data)
