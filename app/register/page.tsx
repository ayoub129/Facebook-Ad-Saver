'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import AuthShell from '@/components/auth/auth-shell'

export default function RegisterPage() {
  const router = useRouter()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    })

    const data = await res.json()

    if (!res.ok || !data?.success) {
      setLoading(false)
      setError(data?.message || 'Failed to create account')
      return
    }

    const loginResult = await signIn('credentials', {
      email,
      password,
      redirect: false,
    })

    setLoading(false)

    if (loginResult?.error) {
      router.push('/login')
      return
    }

    router.push('/')
    router.refresh()
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Register once, then save and manage ads across your workspace."
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="mb-2 block text-sm font-medium text-zinc-200">
            Name
          </label>
          <input
            type="text"
            className="w-full rounded-xl border border-white/10 bg-white/6 px-4 py-3 text-sm text-white outline-none transition placeholder:text-red-50/35 focus:border-red-500/60 focus:bg-white/10 focus:ring-4 focus:ring-red-500/10"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-zinc-200">
            Email
          </label>
          <input
            type="email"
            className="w-full rounded-xl border border-white/10 bg-white/6 px-4 py-3 text-sm text-white outline-none transition placeholder:text-red-50/35 focus:border-red-500/60 focus:bg-white/10 focus:ring-4 focus:ring-red-500/10"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-zinc-200">
            Password
          </label>
          <input
            type="password"
            className="w-full rounded-xl border border-white/10 bg-white/6 px-4 py-3 text-sm text-white outline-none transition placeholder:text-red-50/35 focus:border-red-500/60 focus:bg-white/10 focus:ring-4 focus:ring-red-500/10"
            placeholder="At least 6 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
        </div>

        {error ? (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        ) : null}

        <Button
          type="submit"
          className="h-11 w-full rounded-xl bg-[#ed1227] text-sm font-semibold text-white shadow-lg shadow-red-950/30 transition hover:bg-[#cf0d20]"
          disabled={loading}
        >
          {loading ? 'Creating account...' : 'Create account'}
        </Button>

        <p className="text-center text-sm text-red-50/60">
          Already have an account?{' '}
          <Link href="/login" className="font-medium text-white underline decoration-red-500 underline-offset-4">
            Log in
          </Link>
        </p>
      </form>
    </AuthShell>
  )
}
