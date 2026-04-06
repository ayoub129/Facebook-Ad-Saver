'use client'

import { useMemo, useState } from 'react'
import Sidebar from '@/components/sidebar'
import AdGrid from '@/components/ad-grid'
import AdDetailView from '@/components/ad-detail-view'
import BoardOverview from '@/components/board-overview'
import { useBoards } from '@/components/ui/boards-provider'

export default function Home() {
  const [selectedAdId, setSelectedAdId] = useState<string | null>(null)
  const { selectedBoard, selectedBoardId, setSelectedBoardId } = useBoards()

  const isParentBoard = useMemo(() => {
    return Boolean(selectedBoard && !selectedBoard.parentBoardId)
  }, [selectedBoard])

  if (selectedAdId) {
    return (
      <AdDetailView
        adId={selectedAdId}
        onBack={() => setSelectedAdId(null)}
      />
    )
  }

  return (
    <div className="flex h-screen bg-background w-screen overflow-hidden">
      <Sidebar />

      {isParentBoard && selectedBoardId ? (
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