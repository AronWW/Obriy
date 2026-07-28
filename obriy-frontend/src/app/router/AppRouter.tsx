import { Navigate, Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from '../../features/auth/components/ProtectedRoute'
import { PublicOnlyRoute } from '../../features/auth/components/PublicOnlyRoute'
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

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />

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
        <Route path="/app" element={<DesignLabPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
