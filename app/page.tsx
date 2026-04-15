'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Sidebar from '@/components/sidebar'
import AdGrid from '@/components/ad-grid'
import AdDetailView from '@/components/ad-detail-view'
import PendingShareInvitesModal from '@/components/pending-share-invites-modal'
import { useBoards } from '@/components/ui/boards-provider'

export default function Home() {
  const router = useRouter()
  const { status } = useSession()
  const { refreshBoards } = useBoards()
  const [hasShareToken, setHasShareToken] = useState(false)

  const [selectedAdId, setSelectedAdId] = useState<string | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    setHasShareToken(Boolean(params.get('shareToken')))
  }, [])

  useEffect(() => {
    if (status === 'unauthenticated' && !hasShareToken) {
      router.replace('/login?callbackUrl=/')
    }
  }, [status, router, hasShareToken])

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

  if (status === 'unauthenticated' && !hasShareToken) {
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

      {status === 'authenticated' && (
        <PendingShareInvitesModal
          onResolved={() => {
            void refreshBoards()
          }}
        />
      )}
    </div>
  )
}