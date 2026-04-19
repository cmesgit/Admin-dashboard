import { createContext, useContext, useState, useCallback, useEffect } from "react";
import api from "../api/apiClient";

const AuthContext = createContext(null);

const STORAGE_KEY = "shiksha_admin_session";

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const isAuthenticated = !!user;

  const bootstrap = useCallback(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setUser(JSON.parse(saved));
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  const login = async (email, password) => {
    await api.post("/accounts/login/", { email, password });
    const { data } = await api.get("/accounts/me/");
    if (!data.is_staff) {
      await api.post("/accounts/logout/").catch(() => { });
      throw { message: "Not authorized for admin access." };
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    setUser(data);
    return data;
  };

  const logout = async () => {
    try { await api.post("/accounts/logout/"); } catch { }
    localStorage.removeItem(STORAGE_KEY);
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

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        loading,
        login,
        logout,
        hasRole,
        bootstrap,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
