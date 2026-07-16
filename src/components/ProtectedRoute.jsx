import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, user, loading, hasRole } = useAuth();
  const location = useLocation();

  if (loading) return null;

  if (!isAuthenticated || !(hasRole("ADMIN") || hasRole("MODERATOR"))) {
    return <Navigate to="/login" replace />;
  }

  // A moderator-only account (no ADMIN role) only has the Moderator Panel —
  // every other route (Overview, Users, Payments, ...) is admin-only, so a
  // bookmarked/typed URL there gets redirected instead of showing a broken,
  // 403-riddled page.
  if (!hasRole("ADMIN") && location.pathname !== "/moderator") {
    return <Navigate to="/moderator" replace />;
  }

  return children;
};

export default ProtectedRoute;
