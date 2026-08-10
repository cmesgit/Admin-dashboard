import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading, hasRole } = useAuth();

  if (loading) return null;

  // The admin app is ADMIN-only. Moderators do their work in the public
  // frontend's Moderator Panel, not here.
  if (!isAuthenticated || !hasRole("ADMIN")) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default ProtectedRoute;
