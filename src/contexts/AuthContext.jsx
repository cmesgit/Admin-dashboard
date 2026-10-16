import { createContext, useContext, useState, useCallback, useEffect } from "react";
import api from "../api/apiClient";
import { adminSessionLoader } from "../utils/adminSession";

const AuthContext = createContext(null);

const STORAGE_KEY = "shiksha_admin_session";
const loadCurrentAdmin = adminSessionLoader(api);
const rememberSession = (current) => {
  try {
    if (current) localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    else localStorage.removeItem(STORAGE_KEY);
  } catch { /* Cookie authentication still works when browser storage is unavailable. */ }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const isAuthenticated = !!user;

  const [sessionError, setSessionError] = useState("");
  const bootstrap = useCallback(async () => {
    setLoading(true);
    setSessionError("");
    try {
      const current = await loadCurrentAdmin();
      setUser(current);
      rememberSession(current);
    } catch {
      // A transient outage is not a logout. Keep the cookies and show retry;
      // do not render cached roles as if they were the current server identity.
      setSessionError("We couldn’t check your session. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  const login = async (email, password) => {
    await api.post("/accounts/login/", { email, password });
    const { data } = await api.get("/accounts/me/");
    const roles = Array.isArray(data.roles) ? data.roles.map((r) => String(r).toUpperCase()) : [];
    // Admin app is ADMIN-only; moderators use the public frontend panel.
    const isAuthorized = roles.includes("ADMIN");
    if (!isAuthorized) {
      await api.post("/accounts/logout/").catch(() => { });
      throw { message: "Not authorized for admin access." };
    }
    rememberSession(data);
    setUser(data);
    return data;
  };

  const logout = async () => {
    try { await api.post("/accounts/logout/"); } catch { }
    rememberSession(null);
    setUser(null);
  };

  const hasRole = (role) => {
    if (!user) return false;
    const target = String(role).toLowerCase();
    if (Array.isArray(user.roles)) {
      return user.roles.some((r) => String(r).toLowerCase() === target);
    }
    return false;
  };

  // RBAC: /accounts/me/ returns a `permissions` codename array. Admins hold
  // every permission server-side, so treat ADMIN as an implicit wildcard here.
  const hasPermission = (codename) => {
    if (!user) return false;
    if (hasRole("ADMIN")) return true;
    return Array.isArray(user.permissions) && user.permissions.includes(codename);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        loading,
        login,
        logout,
        hasRole,
        hasPermission,
        bootstrap,
        sessionError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
