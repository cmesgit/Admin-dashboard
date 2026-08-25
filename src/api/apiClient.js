import axios from "axios";
import { API_URL } from "../config/urls";

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  // Without this a request that never settles leaves the calling screen on its
  // spinner forever. Observed on the Courses page: the request to
  // /courses/admin/courses/ stalled in flight, so `setLoading(false)` never
  // ran and the view sat on "Loading…" indefinitely while also showing
  // "0 courses" — indistinguishable from an empty database. A finite timeout
  // turns that into a normal rejection, which `safe()` already handles (it
  // returns the empty fallback tagged `__failed`).
  //
  // 30s is deliberately generous: some admin list endpoints aggregate counts
  // across every course, so this is a backstop against a hung connection, not
  // a latency budget.
  timeout: 30000,
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
