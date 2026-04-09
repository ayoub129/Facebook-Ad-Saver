'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Sidebar from '@/components/sidebar'
import AdGrid from '@/components/ad-grid'
import AdDetailView from '@/components/ad-detail-view'
import BoardOverview from '@/components/board-overview'
import { useBoards } from '@/components/ui/boards-provider'

export default function Home() {
  const router = useRouter()
  const { data: session, status } = useSession()

  const [selectedAdId, setSelectedAdId] = useState<string | null>(null)
  const { selectedBoard, selectedBoardId, setSelectedBoardId } = useBoards()

  const isParentBoard = useMemo(() => {
    return Boolean(selectedBoard && !selectedBoard.parentBoardId)
  }, [selectedBoard])

  const isAdLibraryBoard = useMemo(() => {
    return selectedBoard?.source === 'ad-library'
  }, [selectedBoard])

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login?callbackUrl=/')
    }
  }, [status, router])

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

  if (selectedAdId) {
    return (
      <AdDetailView
        adId={selectedAdId}
        onBack={() => setSelectedAdId(null)}
      />
    )
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      <Sidebar />

      {isParentBoard && selectedBoardId && !isAdLibraryBoard ? (
        <BoardOverview
          parentBoardId={selectedBoardId}
          onOpenSubboard={(subboardId) => setSelectedBoardId(subboardId)}
        />
      ) : (
        <AdGrid onAdClick={setSelectedAdId} />
      )}
    </div>
  )
}