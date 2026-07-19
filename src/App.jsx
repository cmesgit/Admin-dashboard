import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./contexts/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminLayout from "./components/AdminLayout";
import Login from "./pages/Login";
import Overview from "./pages/Overview";
import Users from "./pages/Users";
import UserDetail from "./pages/UserDetail";
import Courses from "./pages/Courses";
import RolesPage from "./pages/roles/RolesPage";
import ContentPanel from "./pages/content/ContentPanel";
import AcademyQuizzes from "./pages/AcademyQuizzes";
import CommunicationReports from "./pages/CommunicationReports";
import CommunicationBroadcast from "./pages/CommunicationBroadcast";
import CommunicationSupport from "./pages/CommunicationSupport";
import Approvals from "./pages/Approvals";
import Payments from "./pages/Payments";
import EnrollmentRequests from "./pages/EnrollmentRequests";
import PaymentSettings from "./pages/PaymentSettings";
import SkillApprovals from "./pages/SkillApprovals";
import SkillCourses from "./pages/SkillCourses";
import AdSubscriptions from "./pages/AdSubscriptions";
import AgreementLetter from "./pages/AgreementLetter";
import SkillExperts from "./pages/SkillExperts";
import SkillSessionsAdmin from "./pages/SkillSessionsAdmin";
import EnrollmentManagement from "./pages/EnrollmentManagement";
import CounselorApprovals from "./pages/CounselorApprovals";
import CounselingSessions from "./pages/CounselingSessions";
import LiveStreams from "./pages/LiveStreams";
import LivestreamMonitor from "./pages/LivestreamMonitor";
import Recordings from "./pages/Recordings";
import Teachers from "./pages/Teachers";
import TeacherActivity from "./pages/TeacherActivity";
import ModeratorActivity from "./pages/ModeratorActivity";
import Analytics from "./pages/Analytics";

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
          <Route path="quizzes" element={<AcademyQuizzes />} />
          <Route path="teachers" element={<Teachers />} />
          <Route path="teacher-activity" element={<TeacherActivity />} />
          <Route path="moderator-activity" element={<ModeratorActivity />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="live-streams" element={<LiveStreams />} />
          <Route path="live-streams/monitor" element={<LivestreamMonitor />} />
          <Route path="live-streams/monitor/:id" element={<LivestreamMonitor />} />
          <Route path="recordings" element={<Recordings />} />
          <Route path="roles" element={<RolesPage />} />
          <Route path="content" element={<ContentPanel />} />
          <Route path="communication/reports" element={<CommunicationReports />} />
          <Route path="communication/broadcast" element={<CommunicationBroadcast />} />
          <Route path="communication/support" element={<CommunicationSupport />} />
          <Route path="approvals" element={<Approvals />} />
          <Route path="enrollment-requests" element={<EnrollmentRequests />} />
          <Route path="enrollments" element={<EnrollmentManagement />} />
          <Route path="payments" element={<Payments />} />
          <Route path="payment-settings" element={<PaymentSettings />} />
          <Route path="skill-approvals" element={<SkillApprovals />} />
          <Route path="counselor-approvals" element={<CounselorApprovals />} />
          <Route path="counseling-sessions" element={<CounselingSessions />} />
          <Route path="skill-experts" element={<SkillExperts />} />
          <Route path="skill-sessions" element={<SkillSessionsAdmin />} />
          <Route path="skill-courses" element={<SkillCourses />} />
          <Route path="ad-subscriptions" element={<AdSubscriptions />} />
          <Route path="agreement-letter" element={<AgreementLetter />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppLoader>
  );
};

export default App;
