/// <reference types="vite/client" />
import axios from 'axios';

// Determine API URL
// Priority:
// 1. VITE_API_URL environment variable (from .env file)
// 2. If accessing via IP address (not localhost), use that IP for backend
// 3. Otherwise use proxy (/api)
function getApiBaseUrl(): string {
  // Check if VITE_API_URL is set (from .env or build-time)
  const envApiUrl = import.meta.env.VITE_API_URL;
  if (envApiUrl && envApiUrl !== 'http://localhost:3001') {
    // Use the configured API URL (ensure it has /api suffix)
    return envApiUrl.endsWith('/api') ? envApiUrl : `${envApiUrl}/api`;
  }

  // Check if we're accessing via IP address (not localhost)
  const hostname = window.location.hostname;
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';

  if (!isLocalhost) {
    // Accessing via IP address - connect directly to backend on same IP
    return `http://${hostname}:3001/api`;
  }

  // Use Vite proxy for localhost
  return '/api';
}

const api = axios.create({
  baseURL: getApiBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Include cookies in requests
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);

export default api;
