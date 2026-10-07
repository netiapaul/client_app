import axios from 'axios'
import { getToken } from './session'

const API_URL = process.env.REACT_APP_URL_CONFIG

const ServiceInstance = () => {
  const axiosInstance = axios.create({
    headers: {
      baseURL: `${API_URL}`,
      'Content-Type': 'application/json; charset=utf-8',
      Authorization: `Bearer ${getToken()}`,
    },
  })
  return axiosInstance
}

export { ServiceInstance }
