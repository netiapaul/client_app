import axios from 'axios'
const API_URL = process.env.REACT_APP_URL_CONFIG

const ServiceInstance = () => {
  const axiosInstance = axios.create({
    headers: {
      baseURL: `${API_URL}`,
      'Content-Type': 'application/json; charset=utf-8',
      Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
    },
  })
  return axiosInstance
}

export { ServiceInstance }
