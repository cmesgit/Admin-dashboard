import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, user, loading } = useAuth();

  if (loading) return null;

  if (!isAuthenticated || !user?.is_staff) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default ProtectedRoute;
