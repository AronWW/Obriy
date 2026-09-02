import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from '../../features/auth/components/ProtectedRoute'
import { PublicOnlyRoute } from '../../features/auth/components/PublicOnlyRoute'
import {
  RoleHomeRedirect,
  RoleRoute,
} from '../../features/auth/components/RoleRoute'
import { ParentLayout } from '../../features/parent/components/ParentLayout'
import { ParentChildPage } from '../../features/parent/pages/ParentChildPage'
import { ParentConnectPage } from '../../features/parent/pages/ParentConnectPage'
import { ParentHubPage } from '../../features/parent/pages/ParentHubPage'
import { ParentProgressPage } from '../../features/parent/pages/ParentProgressPage'
import { ParentInviteLandingPage } from '../../features/parent-links/pages/ParentInviteLandingPage'
import {
  ClassmateProfilePage,
  StudentClassesPage,
  TeacherClassDetailPage,
  TeacherClassesPage,
} from '../../features/classes'
import { StudentOverviewPage } from '../../features/student-overview'
import { StudentProfilePage } from '../../features/student-profile'
import { TeacherProfilePage } from '../../features/teacher-profile'
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
import { RoleSelectionPage } from '../../pages/auth/RoleSelectionPage'
import { VerifyEmailPage } from '../../pages/auth/VerifyEmailPage'
import { DesignLabPage } from '../../pages/design-lab/DesignLabPage'
import { HomePage } from '../../pages/home/HomePage'
import { TeacherPlaceholderPage } from '../../pages/teacher/TeacherPlaceholderPage'
import { StudentPlaceholderPage } from '../../pages/student/StudentPlaceholderPage'

const TeacherMapSandboxPage = lazy(() =>
  import('../../features/maps').then((module) => ({
    default: module.TeacherMapSandboxPage,
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
            <Route
              path="tasks"
              element={<StudentPlaceholderPage section="tasks" />}
            />
            <Route
              path="achievements"
              element={<StudentPlaceholderPage section="achievements" />}
            />
            <Route
              path="leaderboard"
              element={<StudentPlaceholderPage section="leaderboard" />}
            />
            <Route path="profile" element={<StudentProfilePage />} />
          </Route>
        </Route>
        <Route element={<RoleRoute role="TEACHER" />}>
          <Route path="/app/teacher" element={<DesignLabPage />}>
            <Route
              index
              element={<TeacherPlaceholderPage section="overview" />}
            />
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
            <Route
              path="analytics"
              element={<TeacherPlaceholderPage section="analytics" />}
            />
            <Route path="profile" element={<TeacherProfilePage />} />
          </Route>
        </Route>
        <Route element={<RoleRoute role="PARENT" />}>
          <Route path="/app/parent" element={<ParentLayout />}>
            <Route index element={<ParentHubPage />} />
            <Route path="child/:childId" element={<ParentChildPage />} />
            <Route
              path="child/:childId/progress"
              element={<ParentProgressPage />}
            />
            <Route path="connect" element={<ParentConnectPage />} />
          </Route>
        </Route>
        <Route element={<RoleRoute role="ADMIN" />}>
          <Route path="/app/admin" element={<DesignLabPage />} />
        </Route>

        <Route path="/app/*" element={<RoleHomeRedirect />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
