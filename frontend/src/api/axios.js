import axios from 'axios';
import toast from 'react-hot-toast';

export const API_ORIGIN = import.meta.env.VITE_API_URL || '';

const api = axios.create({ baseURL: `${API_ORIGIN}/api` });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('bb_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response && err.response.status === 401 && !err.config.url.includes('/auth/login')) {
      localStorage.removeItem('bb_token');
      if (window.location.pathname !== '/login') window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export const errMsg = (e) => (e && e.response && e.response.data && e.response.data.message) || (e && e.message) || 'Something went wrong';

export const showError = (e) => toast.error(errMsg(e));

/** Absolute URL for an uploaded file path stored in the DB. */
export const fileUrl = (p) => (p ? `${API_ORIGIN}/uploads/${p}` : '');

export default api;
