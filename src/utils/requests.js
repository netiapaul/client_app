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
