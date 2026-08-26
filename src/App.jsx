import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./contexts/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminLayout from "./components/AdminLayout";
import Login from "./pages/Login";

// Every route below is its own chunk, not part of the initial bundle — this
// app is 38 admin pages behind a login wall, so nobody pays for Recordings'
// or Analytics' JS on first paint just to see Overview.
const Overview = lazy(() => import("./pages/Overview"));
const Users = lazy(() => import("./pages/Users"));
const UserDetail = lazy(() => import("./pages/UserDetail"));
const Courses = lazy(() => import("./pages/Courses"));
const RolesPage = lazy(() => import("./pages/roles/RolesPage"));
const ContentPanel = lazy(() => import("./pages/content/ContentPanel"));
const BlogEditor = lazy(() => import("./pages/content/BlogEditor"));
const ContentStudioHome = lazy(() => import("./pages/content/ContentStudioHome"));
const Pictures = lazy(() => import("./pages/content/Pictures"));
const PageEditor = lazy(() => import("./pages/content/PageEditor"));
const SkillCMSPanel = lazy(() => import("./pages/skillcms/SkillCMSPanel"));
const ScholarshipPanel = lazy(() => import("./pages/scholarship/ScholarshipPanel"));
const AcademyQuizzes = lazy(() => import("./pages/AcademyQuizzes"));
// A1 · admin question-bank review queue (Phase 7).
const QuestionReviewQueue = lazy(() => import("./pages/QuestionReviewQueue"));
const CommunicationReports = lazy(() => import("./pages/CommunicationReports"));
const CommunicationBroadcast = lazy(() => import("./pages/CommunicationBroadcast"));
const CommunicationSupport = lazy(() => import("./pages/CommunicationSupport"));
const MessageSearch = lazy(() => import("./pages/MessageSearch"));
const Approvals = lazy(() => import("./pages/Approvals"));
const Payments = lazy(() => import("./pages/Payments"));
const EnrollmentRequests = lazy(() => import("./pages/EnrollmentRequests"));
const PaymentSettings = lazy(() => import("./pages/PaymentSettings"));
const SkillCourses = lazy(() => import("./pages/SkillCourses"));
const AdSubscriptions = lazy(() => import("./pages/AdSubscriptions"));
const AgreementLetter = lazy(() => import("./pages/AgreementLetter"));
const SkillExperts = lazy(() => import("./pages/SkillExperts"));
const SkillSessionsAdmin = lazy(() => import("./pages/SkillSessionsAdmin"));
const GroupSessionAttendance = lazy(() => import("./pages/GroupSessionAttendance"));
const EnrollmentManagement = lazy(() => import("./pages/EnrollmentManagement"));
const CounselorApprovals = lazy(() => import("./pages/CounselorApprovals"));
const CounselingSessions = lazy(() => import("./pages/CounselingSessions"));
const LiveStreams = lazy(() => import("./pages/LiveStreams"));
const LiveSessionRules = lazy(() => import("./pages/LiveSessionRules"));
const LivestreamMonitor = lazy(() => import("./pages/LivestreamMonitor"));
const Recordings = lazy(() => import("./pages/Recordings"));
const Teachers = lazy(() => import("./pages/Teachers"));
const Students = lazy(() => import("./pages/Students"));
const StudentDetail = lazy(() => import("./pages/StudentDetail"));
const TeacherActivity = lazy(() => import("./pages/TeacherActivity"));
const ModeratorActivity = lazy(() => import("./pages/ModeratorActivity"));
const Analytics = lazy(() => import("./pages/Analytics"));

const Spinner = () => (
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

const AppLoader = ({ children }) => {
  const { loading } = useAuth();

  if (loading) return <Spinner />;

  return children;
};

const App = () => {
  return (
    <AppLoader>
      <Suspense fallback={<Spinner />}>
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
            <Route path="question-bank/review" element={<QuestionReviewQueue />} />
            <Route path="teachers" element={<Teachers />} />
            <Route path="students" element={<Students />} />
            <Route path="students/:id" element={<StudentDetail />} />
            <Route path="teacher-activity" element={<TeacherActivity />} />
            <Route path="moderator-activity" element={<ModeratorActivity />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="live-streams" element={<LiveStreams />} />
            <Route path="live-session-rules" element={<LiveSessionRules />} />
            <Route path="live-streams/monitor" element={<LivestreamMonitor />} />
            <Route path="live-streams/monitor/:id" element={<LivestreamMonitor />} />
            <Route path="recordings" element={<Recordings />} />
            <Route path="roles" element={<RolesPage />} />
            <Route path="content" element={<ContentPanel />} />
            {/* Registered before "content" would be fine too (react-router v7
                matches by specificity, not declaration order) but keeping the
                more specific blog routes visually grouped next to the parent
                tab route they replace the modal for. */}
            {/* Content Studio landing screen (Phase 3). Sits alongside the
                eight-tab panel rather than replacing it, so every existing
                /content and /content?tab= URL keeps resolving. */}
            <Route path="content/home" element={<ContentStudioHome />} />
            <Route path="content/pictures" element={<Pictures />} />
            <Route path="content/pages/:key" element={<PageEditor />} />
            <Route path="content/blogs/new" element={<BlogEditor />} />
            <Route path="content/blogs/:id" element={<BlogEditor />} />
            <Route path="communication/reports" element={<CommunicationReports />} />
            <Route path="communication/messages" element={<MessageSearch />} />
            <Route path="communication/broadcast" element={<CommunicationBroadcast />} />
            <Route path="communication/support" element={<CommunicationSupport />} />
            <Route path="approvals" element={<Approvals />} />
            <Route path="enrollment-requests" element={<EnrollmentRequests />} />
            <Route path="enrollments" element={<EnrollmentManagement />} />
            <Route path="payments" element={<Payments />} />
            <Route path="payment-settings" element={<PaymentSettings />} />
            <Route path="counselor-approvals" element={<CounselorApprovals />} />
            <Route path="counseling-sessions" element={<CounselingSessions />} />
            <Route path="skill-experts" element={<SkillExperts />} />
            <Route path="skill-sessions" element={<SkillSessionsAdmin />} />
            <Route path="group-session-attendance" element={<GroupSessionAttendance />} />
            <Route path="skill-courses" element={<SkillCourses />} />
            <Route path="skill-cms" element={<SkillCMSPanel />} />
            <Route path="scholarship" element={<ScholarshipPanel />} />
            <Route path="ad-subscriptions" element={<AdSubscriptions />} />
            <Route path="agreement-letter" element={<AgreementLetter />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </AppLoader>
  );
};

export default App;
