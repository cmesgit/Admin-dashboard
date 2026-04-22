import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "https://api.shikshacom.com/api",
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
    if (
      error.response?.status !== 401 ||
      originalRequest._retry ||
      originalRequest.url?.includes("/accounts/refresh/") ||
      originalRequest.url?.includes("/accounts/login/")
    ) return Promise.reject(error);

    if (isRefreshing) {
      return new Promise((resolve, reject) => failedQueue.push({ resolve, reject }))
        .then(() => api(originalRequest));
    }

    originalRequest._retry = true;
    isRefreshing = true;
    try {
      await axios.post(
        `${import.meta.env.VITE_API_URL || "https://api.shikshacom.com/api"}/accounts/refresh/`,
        {},
        { withCredentials: true }
      );
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