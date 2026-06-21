import axios from "axios";
import { API_URL } from "../config/urls";

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error) => {
  failedQueue.forEach((p) => (error ? p.reject(error) : p.resolve()));
  failedQueue = [];
};

api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const originalRequest = error.config;
    const url = originalRequest?.url || "";
    // Never bounce on the auth probes themselves.
    if (
      error.response?.status !== 401 ||
      originalRequest._retry ||
      url.includes("/accounts/refresh/") ||
      url.includes("/accounts/login/") ||
      url.includes("/accounts/me/")
    ) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => failedQueue.push({ resolve, reject }))
        .then(() => api(originalRequest));
    }

    originalRequest._retry = true;
    isRefreshing = true;
    try {
      await axios.post(`${API_URL}/accounts/refresh/`, {}, { withCredentials: true });
      processQueue(null);
      return api(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError);
      window.location.href = "/login";
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

export default api;
