import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from '../../features/auth/components/ProtectedRoute'
import { PublicOnlyRoute } from '../../features/auth/components/PublicOnlyRoute'
import {
  RoleHomeRedirect,
  RoleRoute,
} from '../../features/auth/components/RoleRoute'
import { ParentLayout } from '../../features/parent/components/ParentLayout'
import { ParentProfilePage } from '../../features/parent/pages/ParentProfilePage'
import { ParentChildPage } from '../../features/parent/pages/ParentChildPage'
import { ParentConnectPage } from '../../features/parent/pages/ParentConnectPage'
import { ParentHubPage } from '../../features/parent/pages/ParentHubPage'
import { ParentProgressPage } from '../../features/parent/pages/ParentProgressPage'
import { ParentLessonDetailPage } from '../../features/parent/pages/ParentLessonDetailPage'
import { ParentTestDetailPage } from '../../features/parent/pages/ParentTestDetailPage'
import { ParentInviteLandingPage } from '../../features/parent-links/pages/ParentInviteLandingPage'
import {
  ClassmateProfilePage,
  StudentClassesPage,
  TeacherClassDetailPage,
  TeacherClassesPage,
} from '../../features/classes'
import { StudentOverviewPage } from '../../features/student-overview'
import { StudentTasksPage } from '../../features/student-workspace'
import { StudentProfilePage } from '../../features/student-profile'
import { StudentLeaderboardPage } from '../../features/leaderboard'
import { StudentAchievementsPage } from '../../features/gamification'
import { ChatWorkspacePage, ParentChatPage } from '../../features/chat'
import {
  AdminAuditPage,
  AdminAppealsPage,
  AdminClassDetailPage,
  AdminClassesPage,
  AdminDashboardPage,
  AdminLayout,
  AdminModerationDetailPage,
  AdminModerationPage,
  AdminProfilePage,
  AdminUserDetailPage,
  AdminUsersPage,
} from '../../features/admin'
import { TeacherProfilePage } from '../../features/teacher-profile'
import { TeacherOverviewPage } from '../../features/teacher-overview'
import {
  TeacherAnalyticsPage,
  TeacherStudentAnalyticsPage,
} from '../../features/teacher-analytics'
import {
  TeacherAssignmentEditorPage,
  TeacherAssignmentsPage,
} from '../../features/assignments'
import { TeacherTestEditorPage, TeacherTestsPage } from '../../features/tests'
import {
  StudentLessonReaderPage,
  TeacherLessonEditorPage,
  TeacherLessonsPage,
} from '../../features/lessons'
import { AuthLayout } from '../../pages/auth/AuthLayout'
import { CheckEmailPage } from '../../pages/auth/CheckEmailPage'
import { ForgotPasswordPage } from '../../pages/auth/ForgotPasswordPage'
import { GoogleCallbackPage } from '../../pages/auth/GoogleCallbackPage'
import { LoginPage } from '../../pages/auth/LoginPage'
import { RegisterPage } from '../../pages/auth/RegisterPage'
import { ResetPasswordPage } from '../../pages/auth/ResetPasswordPage'
import { SuspendedAccountPage } from '../../pages/auth/SuspendedAccountPage'
import { RoleSelectionPage } from '../../pages/auth/RoleSelectionPage'
import { VerifyEmailPage } from '../../pages/auth/VerifyEmailPage'
import { DesignLabPage } from '../../pages/design-lab/DesignLabPage'
import { HomePage } from '../../pages/home/HomePage'

const TeacherMapSandboxPage = lazy(() =>
  import('../../features/maps').then((module) => ({
    default: module.TeacherMapSandboxPage,
  })),
)
const TeacherMapEditorPage = lazy(() =>
  import('../../features/maps').then((module) => ({
    default: module.TeacherMapEditorPage,
  })),
)

export function AppRouter() {
  return (
    <Routes>
      <Route element={<PublicOnlyRoute />}>
        <Route path="/" element={<HomePage />} />
      </Route>
      <Route path="/parent-invite" element={<ParentInviteLandingPage />} />

      <Route path="/auth" element={<AuthLayout />}>
        <Route element={<PublicOnlyRoute />}>
          <Route path="login" element={<LoginPage />} />
          <Route path="register" element={<RoleSelectionPage />} />
          <Route path="register/:role" element={<RegisterPage />} />
          <Route path="check-email" element={<CheckEmailPage />} />
          <Route path="forgot-password" element={<ForgotPasswordPage />} />
          <Route path="suspended" element={<SuspendedAccountPage />} />
        </Route>
        <Route path="verify-email" element={<VerifyEmailPage />} />
        <Route path="reset-password" element={<ResetPasswordPage />} />
        <Route path="google/callback" element={<GoogleCallbackPage />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route path="/app" element={<RoleHomeRedirect />} />

        <Route element={<RoleRoute role="STUDENT" />}>
          <Route path="/app/student" element={<DesignLabPage />}>
            <Route index element={<StudentOverviewPage />} />
            <Route path="classes" element={<StudentClassesPage />} />
            <Route
              path="lessons/:lessonId"
              element={<StudentLessonReaderPage />}
            />
            <Route
              path="classmates/:studentId"
              element={<ClassmateProfilePage />}
            />
            <Route path="tasks" element={<StudentTasksPage />} />
            <Route path="messages" element={<ChatWorkspacePage />} />
            <Route path="messages/:conversationId" element={<ChatWorkspacePage />} />
            <Route path="achievements" element={<StudentAchievementsPage />} />
            <Route
              path="leaderboard"
              element={<StudentLeaderboardPage />}
            />
            <Route path="profile" element={<StudentProfilePage />} />
          </Route>
        </Route>
        <Route element={<RoleRoute role="TEACHER" />}>
          <Route path="/app/teacher" element={<DesignLabPage />}>
            <Route index element={<TeacherOverviewPage />} />
            <Route path="classes" element={<TeacherClassesPage />} />
            <Route
              path="classes/:classId"
              element={<TeacherClassDetailPage />}
            />
            <Route path="lessons" element={<TeacherLessonsPage />} />
            <Route path="lessons/new" element={<TeacherLessonEditorPage />} />
            <Route
              path="lessons/:lessonId/edit"
              element={<TeacherLessonEditorPage />}
            />
            <Route path="tasks" element={<TeacherAssignmentsPage />} />
            <Route
              path="maps"
              element={
                <Suspense fallback={null}>
                  <TeacherMapSandboxPage />
                </Suspense>
              }
            />
            <Route
              path="maps/editor/:draftId"
              element={
                <Suspense fallback={null}>
                  <TeacherMapEditorPage />
                </Suspense>
              }
            />
            <Route
              path="tasks/new/:assignmentType"
              element={<TeacherAssignmentEditorPage />}
            />
            <Route
              path="tasks/:assignmentId/edit"
              element={<TeacherAssignmentEditorPage />}
            />
            <Route path="tests" element={<TeacherTestsPage />} />
            <Route path="tests/new" element={<TeacherTestEditorPage />} />
            <Route
              path="tests/:testId/edit"
              element={<TeacherTestEditorPage />}
            />
            <Route path="analytics" element={<TeacherAnalyticsPage />} />
            <Route path="messages" element={<ChatWorkspacePage />} />
            <Route path="messages/:conversationId" element={<ChatWorkspacePage />} />
            <Route
              path="analytics/classes/:classId/students/:studentId"
              element={<TeacherStudentAnalyticsPage />}
            />
            <Route path="profile" element={<TeacherProfilePage />} />
          </Route>
        </Route>
        <Route element={<RoleRoute role="PARENT" />}>
          <Route path="/app/parent" element={<ParentLayout />}>
            <Route index element={<ParentHubPage />} />
            <Route path="profile" element={<ParentProfilePage />} />
            <Route path="child/:childId" element={<ParentChildPage />} />
            <Route
              path="child/:childId/progress"
              element={<ParentProgressPage />}
            />
            <Route path="child/:childId/lessons/:lessonId" element={<ParentLessonDetailPage />} />
            <Route path="child/:childId/tests/:releaseId" element={<ParentTestDetailPage />} />
            <Route path="child/:childId/messages" element={<ParentChatPage />} />
            <Route path="child/:childId/messages/:conversationId" element={<ParentChatPage />} />
            <Route path="connect" element={<ParentConnectPage />} />
          </Route>
        </Route>
        <Route element={<RoleRoute role="ADMIN" />}>
          <Route path="/app/admin" element={<AdminLayout />}>
            <Route index element={<AdminDashboardPage />} />
            <Route path="users" element={<AdminUsersPage />} />
            <Route path="users/:userId" element={<AdminUserDetailPage />} />
            <Route path="classes" element={<AdminClassesPage />} />
            <Route path="classes/:classId" element={<AdminClassDetailPage />} />
            <Route path="moderation" element={<AdminModerationPage />} />
            <Route path="moderation/:caseId" element={<AdminModerationDetailPage />} />
            <Route path="appeals" element={<AdminAppealsPage />} />
            <Route path="audit" element={<AdminAuditPage />} />
            <Route path="profile" element={<AdminProfilePage />} />
          </Route>
        </Route>

        <Route path="/app/*" element={<RoleHomeRedirect />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
