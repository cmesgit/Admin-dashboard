import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, user, loading, hasRole } = useAuth();

  if (loading) return null;

  if (!isAuthenticated || !hasRole("ADMIN")) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default ProtectedRoute;
