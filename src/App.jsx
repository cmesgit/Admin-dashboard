import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./contexts/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminLayout from "./components/AdminLayout";
import Login from "./pages/Login";
import Overview from "./pages/Overview";
import Users from "./pages/Users";
import UserDetail from "./pages/UserDetail";
import Courses from "./pages/Courses";
import Forum from "./pages/Forum";
import Approvals from "./pages/Approvals";
import Payments from "./pages/Payments";

const AppLoader = ({ children }) => {
  const { loading } = useAuth();

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
        <div style={{ textAlign: "center", color: "#555" }}>
          <div
            style={{
              width: 42,
              height: 42,
              margin: "0 auto 12px",
              border: "3px solid #e5e7eb",
              borderTop: "3px solid #4f6df5",
              borderRadius: "50%",
              animation: "spin 0.8s linear infinite",
            }}
          />
          Loading...
        </div>
      </div>
    );
  }

  return children;
};

const App = () => {
  return (
    <AppLoader>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          element={
            <ProtectedRoute>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Overview />} />
          <Route path="users" element={<Users />} />
          <Route path="users/:id" element={<UserDetail />} />
          <Route path="courses" element={<Courses />} />
          <Route path="forum" element={<Forum />} />
          <Route path="approvals" element={<Approvals />} />
          <Route path="payments" element={<Payments />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppLoader>
  );
};

export default App;
