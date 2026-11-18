import axios from 'axios';

// Cookie-only auth: the access token lives in an httpOnly cookie set by the
// backend (never in localStorage), so XSS cannot steal it. All requests send
// cookies via withCredentials; expired cookies are refreshed transparently.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Response interceptor - handle 401 (cookie refresh + single retry)
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        await axios.post(
          `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/auth/refresh`,
          {},
          { withCredentials: true }
        );
        return api(originalRequest);
      } catch (refreshError) {
        localStorage.removeItem('user');
        localStorage.removeItem('accessToken'); // legacy cleanup (no longer written)
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }
    // Friendly message for rate limiting (HTTP 429)
    if (error.response?.status === 429) {
      error.message =
        error.response?.data?.message ||
        'Too many requests. Please wait a moment and try again.';
    }
    return Promise.reject(error);
  }
);

export default api;
