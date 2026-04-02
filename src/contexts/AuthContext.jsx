import { createContext, useContext, useState, useCallback, useEffect } from "react";

const AuthContext = createContext(null);

const MOCK_ADMIN = {
  id: "admin-001",
  email: "admin@shikshacom.com",
  username: "admin",
  is_staff: true,
  roles: ["ADMIN"],
};

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
    if (!email || !password) {
      return Promise.reject({ message: "Email and password are required." });
    }

    const mockUser = { ...MOCK_ADMIN, email };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(mockUser));
    setUser(mockUser);
    return mockUser;
  };

  const logout = async () => {
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
