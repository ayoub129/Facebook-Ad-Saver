import type { ReactNode } from 'react'
import { Card } from '@/components/ui/card'

export default function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: ReactNode
}) {
  return (
    <div className="min-h-screen bg-black text-foreground">
      <div className="mx-auto flex min-h-screen max-w-6xl items-center px-6 py-10">
        <div className="grid w-full gap-8 lg:grid-cols-[1.1fr_480px]">
          <div className="hidden rounded-3xl border border-white/10 bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 p-10 lg:flex lg:flex-col lg:justify-between">
            <div>
              <div className="mb-6 inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-300">
                Save winning ads faster
              </div>
              <h1 className="max-w-xl text-4xl font-semibold leading-tight text-white">
                Organize ad inspiration, boards, and media in one clean workspace.
              </h1>
              <p className="mt-4 max-w-lg text-sm leading-6 text-zinc-400">
                Log in to save ads, manage boards, and keep your workflow synced between the app and extension.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <Card className="border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase text-zinc-500">Boards</p>
                <p className="mt-2 text-lg font-semibold text-white">Organized</p>
              </Card>
              <Card className="border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase text-zinc-500">Media</p>
                <p className="mt-2 text-lg font-semibold text-white">Collected</p>
              </Card>
              <Card className="border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase text-zinc-500">Workflow</p>
                <p className="mt-2 text-lg font-semibold text-white">Synced</p>
              </Card>
            </div>
          </div>

          <Card className="rounded-3xl border-white/10 bg-zinc-950/95 p-6 shadow-2xl shadow-black/30 sm:p-8">
            <div className="mb-8">
              <h2 className="text-2xl font-semibold text-white">{title}</h2>
              <p className="mt-2 text-sm text-zinc-400">{subtitle}</p>
            </div>
            {children}
          </Card>
        </div>
      </div>
    </div>
  )
}