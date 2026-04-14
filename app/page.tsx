'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Sidebar from '@/components/sidebar'
import AdGrid from '@/components/ad-grid'
import AdDetailView from '@/components/ad-detail-view'

export default function Home() {
  const router = useRouter()
  const { data: session, status } = useSession()

  const [selectedAdId, setSelectedAdId] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login?callbackUrl=/')
    }
  }, [status, router])

  useEffect(() => {
    if (!selectedAdId) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [selectedAdId])

  if (status === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-foreground">
        Loading...
      </div>
    )
  }

  if (status === 'unauthenticated') {
    return null
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      <Sidebar />

      <AdGrid onAdClick={setSelectedAdId} />

      {selectedAdId && (
        <div className="fixed inset-0 z-50 bg-black/20 backdrop-blur-[1px]">
          <AdDetailView
            adId={selectedAdId}
            onBack={() => setSelectedAdId(null)}
          />
        </div>
      )}
    </div>
  )
}