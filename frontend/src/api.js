import axios from 'axios';

const API = axios.create({
  baseURL: 'https://profound-smile-production-f645.up.railway.app/api/v1',
});

API.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default API;