import { Suspense } from 'react'
import AuthShell from '@/components/auth/auth-shell'
import LoginPageClient from './login-page-client'

function LoginPageFallback() {
  return (
    <AuthShell
      title="Welcome back"
      subtitle="Log in to access your saved ads and boards."
    >
      <div className="rounded-xl border border-white/10 bg-white/6 px-4 py-3 text-sm text-red-50/70">
        Loading...
      </div>
    </AuthShell>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginPageFallback />}>
      <LoginPageClient />
    </Suspense>
  )
}
