import { Suspense } from 'react'
import LoginPageClient from './login-page-client'

function LoginPageFallback() {
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto flex min-h-screen max-w-6xl items-center px-6 py-10">
        <div className="grid w-full gap-8 lg:grid-cols-[1.1fr_480px]">
          <div className="hidden rounded-3xl border border-white/10 bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 p-10 lg:flex lg:flex-col lg:justify-between">
            <div>
              <div className="mb-6 inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-300">
                Save winning ads faster
              </div>
              <h1 className="max-w-xl text-4xl font-semibold leading-tight text-white">
                Log in to manage saved ads and boards.
              </h1>
              <p className="mt-4 max-w-lg text-sm leading-6 text-zinc-400">
                Keep your saved ads synced with your workspace.
              </p>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-zinc-950/95 p-6 shadow-2xl shadow-black/30 sm:p-8">
            <div className="mb-8">
              <h2 className="text-2xl font-semibold text-white">Welcome back</h2>
              <p className="mt-2 text-sm text-zinc-400">
                Log in to access your saved ads and boards.
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-300">
              Loading...
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginPageFallback />}>
      <LoginPageClient />
    </Suspense>
  )
}