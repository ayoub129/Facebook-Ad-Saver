import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'
import { BoardsProvider } from "@/components/ui/boards-provider";
import AuthSessionProvider from '@/components/providers/auth-session-provider'
import { Toaster } from '@/components/ui/toaster'

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: 'Swoopface',
  description: 'Organize and browse saved ads with an intuitive dashboard interface',
  generator: 'v0.app',
  icons: {
    icon: '/Icon-transparent.png',
    shortcut: '/Icon-transparent.png',
    apple: '/Icon-transparent.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <AuthSessionProvider>
          <BoardsProvider>
            {children}
          </BoardsProvider>
          <Toaster />
        </AuthSessionProvider>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
