'use client'

import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, LogOut, Share2, User } from 'lucide-react'
import { signOut } from 'next-auth/react'
import { Input } from '@/components/ui/input'
import AdCard, { type DashboardAd } from './ad-card'
import { useBoards } from '@/components/ui/boards-provider'
import DeleteBoardModal from '@/components/delete-board-modal'
import MoveAdModal from '@/components/move-ad-modal'
import { Card } from '@/components/ui/card'
import ShareBoardModal from '@/components/share-board-modal'
import { useToast } from '@/hooks/use-toast'

interface AdGridProps {
  onAdClick: (adId: string) => void
}

type BreadcrumbItem = {
  _id: string
  name: string
}

type AdItem = DashboardAd
type GridItem =
  | { type: 'subboard'; id: string; name: string }
  | { type: 'ad'; id: string; ad: AdItem }

export default function AdGrid({ onAdClick }: AdGridProps) {
  const {
    boards,
    selectedBoardId,
    setSelectedBoardId,
    selectedBoard,
  } = useBoards()
  const canManageSelectedBoard =
    selectedBoard?.accessRole === 'owner' || selectedBoard?.accessRole === 'editor'

  const [ads, setAds] = useState<AdItem[]>([])
  const [loadingAds, setLoadingAds] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState('recent')
  const [showSortMenu, setShowSortMenu] = useState(false)
  const [playingVideoId, setPlayingVideoId] = useState<string | null>(null)
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<AdItem | null>(null)
  const [moveTarget, setMoveTarget] = useState<AdItem | null>(null)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [subboardPreviewAds, setSubboardPreviewAds] = useState<Record<string, AdItem[]>>({})
  const [isShareModalOpen, setIsShareModalOpen] = useState(false)
  const { toast } = useToast()

  // 🔥 NEW
  const [columnsCount, setColumnsCount] = useState(4)

  const [shareToken, setShareToken] = useState<string | null>(null)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    setShareToken(params.get('shareToken'))
  }, [])

  const withShareToken = (path: string) => {
    if (!shareToken) return path
    const hasQuery = path.includes('?')
    return `${path}${hasQuery ? '&' : '?'}shareToken=${encodeURIComponent(shareToken)}`
  }

  const handleDeleteAd = (adId: string) => {
    const ad = ads.find((item) => item._id === adId)
    if (!ad) return
    setDeleteTarget(ad)
  }

  const handleMoveAd = (adId: string) => {
    const ad = ads.find((item) => item._id === adId)
    if (!ad) return
    setMoveTarget(ad)
  }

  const confirmDeleteAd = async () => {
    if (!deleteTarget) return

    try {
      const res = await fetch(withShareToken(`/api/ads/${deleteTarget._id}`), {
        method: 'DELETE',
      })

      const data = await res.json()

      if (!res.ok || !data?.success) {
        throw new Error(data?.message || 'Failed to delete ad')
      }

      setAds((prev) => prev.filter((ad) => ad._id !== deleteTarget._id))
      setDeleteTarget(null)
    } catch (error) {
      console.error(error)
      toast({
        title: 'Failed to delete ad',
        description: error instanceof Error ? error.message : 'Please try again.',
      })
      throw error
    }
  }

  const confirmMoveAd = async (boardId: string) => {
    if (!moveTarget) return

    const res = await fetch(withShareToken(`/api/ads/${moveTarget._id}`), {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        boardId,
      }),
    })

    const data = await res.json()
    if (!res.ok || !data?.success) {
      throw new Error(data?.message || 'Failed to move ad')
    }

    setAds((prev) => prev.filter((ad) => ad._id !== moveTarget._id))
    setMoveTarget(null)
  }

  const handleSignOut = async () => {
    try {
      setIsSigningOut(true)
      setShowProfileMenu(false)
      await signOut({ callbackUrl: '/login' })
    } catch (error) {
      console.error('Sign out failed:', error)
      toast({
        title: 'Failed to sign out',
        description: 'Please try again.',
      })
    } finally {
      setIsSigningOut(false)
    }
  }

  useEffect(() => {
    const fetchAds = async () => {
      try {
        if (!selectedBoardId || !selectedBoard) {
          setAds([])
          return
        }

        setLoadingAds(true)

        const res = await fetch(withShareToken(`/api/ads?boardId=${encodeURIComponent(selectedBoardId)}`), {
          method: 'GET',
          cache: 'no-store',
        })

        const data = await res.json()

        if (!res.ok || !data?.success) {
          throw new Error(data?.message || 'Failed to fetch ads')
        }

        setAds(Array.isArray(data.ads) ? data.ads : [])
      } catch (error) {
        console.error('Failed to fetch ads:', error)
        setAds([])
      } finally {
        setLoadingAds(false)
      }
    }

    fetchAds()
  }, [selectedBoardId, selectedBoard])

  const breadcrumbItems = useMemo(() => {
    if (!selectedBoardId) return []

    const map = new Map(boards.map((board) => [board._id, board]))
    const path: BreadcrumbItem[] = []

    let current = map.get(selectedBoardId)

    while (current) {
      path.unshift({
        _id: current._id,
        name: current.name,
      })

      current = current.parentBoardId
        ? map.get(current.parentBoardId as string) ?? undefined
        : undefined
    }

    return path
  }, [boards, selectedBoardId])

  const filteredAds = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()

    let nextAds = [...ads]

    if (term) {
      nextAds = nextAds.filter((ad) => {
        const haystack = [
          ad.advertiserName,
          ad.adLibraryId,
          ad.adCopy,
          ad.headline,
          ad.description,
          ad.ctaText,
        ]
          .join(' ')
          .toLowerCase()

        return haystack.includes(term)
      })
    }

    nextAds.sort((a, b) => {
      if (sortBy === 'oldest') {
        return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()
      }

      if (sortBy === 'az') {
        return (a.advertiserName || '').localeCompare(b.advertiserName || '')
      }

      if (sortBy === 'za') {
        return (b.advertiserName || '').localeCompare(a.advertiserName || '')
      }

      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    })

    return nextAds
  }, [ads, searchTerm, sortBy])

  const childBoards = useMemo(() => {
    if (!selectedBoardId) return []
    return boards
      .filter((board) => board.parentBoardId === selectedBoardId)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  }, [boards, selectedBoardId])

  useEffect(() => {
    const loadSubboardPreviews = async () => {
      if (!childBoards.length) {
        setSubboardPreviewAds({})
        return
      }

      try {
        const entries = await Promise.all(
          childBoards.map(async (board) => {
            const res = await fetch(withShareToken(`/api/ads?boardId=${encodeURIComponent(board._id)}`), {
              method: 'GET',
              cache: 'no-store',
            })

            if (!res.ok) return [board._id, []] as const
            const data = await res.json()
            const boardAds = Array.isArray(data?.ads) ? (data.ads as AdItem[]) : []
            return [board._id, boardAds] as const
          })
        )

        setSubboardPreviewAds(Object.fromEntries(entries))
      } catch (error) {
        console.error('Failed to load subboard previews:', error)
        setSubboardPreviewAds({})
      }
    }

    loadSubboardPreviews()
  }, [childBoards])

  const gridItems = useMemo<GridItem[]>(() => {
    const subboardItems = childBoards.map((board) => ({
      type: 'subboard' as const,
      id: board._id,
      name: board.name,
    }))
    const adItems = filteredAds.map((ad) => ({
      type: 'ad' as const,
      id: ad._id,
      ad,
    }))
    return [...subboardItems, ...adItems]
  }, [childBoards, filteredAds])

  const columns = useMemo(() => {
    const cols: GridItem[][] = Array.from({ length: columnsCount }, () => [])
    gridItems.forEach((item, index) => {
      cols[index % columnsCount].push(item)
    })
    return cols
  }, [gridItems, columnsCount])

  const handleVideoPlay = (id: string) => {
    setPlayingVideoId(id)
  }

  const handleVideoPause = () => {
    setPlayingVideoId(null)
  }

  const sortOptions = [
    { label: 'Recently Added', value: 'recent' },
    { label: 'Oldest', value: 'oldest' },
    { label: 'A → Z', value: 'az' },
    { label: 'Z → A', value: 'za' },
  ]

  return (
    <>
      <div className="flex h-screen flex-1 min-w-0 flex-col bg-background">
        <div className="border-b border-border bg-background px-6 py-4">
          <div className="flex items-center justify-between gap-4">

            {/* LEFT */}
            <div className="flex min-w-[180px] items-center gap-1 text-sm font-medium text-foreground">
              {breadcrumbItems.length > 0 ? (
                breadcrumbItems.map((item, index) => {
                  const isLast = index === breadcrumbItems.length - 1

                  return (
                    <div key={item._id} className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setSelectedBoardId(item._id)}
                        className={`cursor-pointer rounded px-1 py-0.5 transition-colors ${
                          isLast
                            ? 'text-foreground'
                            : 'text-foreground hover:bg-muted hover:text-primary'
                        }`}
                      >
                        {item.name}
                      </button>

                      {!isLast && <span className="text-muted-foreground">/</span>}
                    </div>
                  )
                })
              ) : (
                <span className="text-muted-foreground">Select board...</span>
              )}
            </div>

            {/* SEARCH */}
            <div className="flex-1 max-w-xl">
              <Input
                placeholder="Search ads..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="border-border bg-muted/50 text-sm"
              />
            </div>

            {/* RIGHT */}
            <div className="flex items-center gap-3">

              {/* 🔥 GRID CONTROLLER */}
              <div className="flex items-center gap-3">
  <span className="text-sm text-muted-foreground">Grid</span>

  <div className="flex items-center gap-2">
    {/* Slider */}
    <input
      type="range"
      min={2}
      max={6}
      step={1}
      value={columnsCount}
      onChange={(e) => setColumnsCount(Number(e.target.value))}
      className="w-28 h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
    />

    {/* Value */}
    <span className="text-sm font-medium text-foreground w-5 text-center">
      {columnsCount}
    </span>
  </div>
</div>
              {/* SORT */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowSortMenu(!showSortMenu)}
                  className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm transition hover:bg-muted"
                >
                  Sort
                  <ChevronDown className="h-4 w-4" />
                </button>

                {showSortMenu && (
                  <div className="absolute right-0 z-50 mt-2 w-44 overflow-hidden rounded-lg border border-border bg-card shadow-lg">
                    {sortOptions.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => {
                          setSortBy(option.value)
                          setShowSortMenu(false)
                        }}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => setIsShareModalOpen(true)}
                disabled={!selectedBoardId || !canManageSelectedBoard}
                className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Share2 className="h-4 w-4" />
                Share
              </button>

              {/* PROFILE */}
              <div className="relative">
                <button
                  onClick={() => setShowProfileMenu(!showProfileMenu)}
                  className="cursor-pointer rounded-lg p-2 hover:bg-muted"
                >
                  <User className="h-5 w-5" />
                </button>

                {showProfileMenu && (
                  <div className="absolute right-0 z-50 mt-2 min-w-[150px] rounded-lg border border-border bg-card shadow-lg">
                    <button
                      onClick={handleSignOut}
                      disabled={isSigningOut}
                      className="flex w-full items-center gap-2 px-4 py-3 text-sm hover:bg-muted"
                    >
                      <LogOut className="h-4 w-4" />
                      {isSigningOut ? 'Signing out...' : 'Sign out'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* GRID */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {loadingAds ? (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              Loading ads...
            </div>
          ) : gridItems.length === 0 ? (
            <div className="flex min-h-[260px] items-center justify-center text-muted-foreground">
              No ads yet
            </div>
          ) : (
            <div className="flex gap-5 w-full">
              {columns.map((col, colIndex) => (
                <div key={colIndex} className="flex flex-col gap-5 flex-1">
                  {col.map((item) =>
                    item.type === 'ad' ? (
                      <AdCard
                        key={item.id}
                        ad={item.ad}
                        canManage={canManageSelectedBoard}
                        isPlaying={playingVideoId === item.id}
                        onVideoPlay={() => handleVideoPlay(item.id)}
                        onVideoPause={handleVideoPause}
                        onClick={() => onAdClick(item.id)}
                        onDelete={canManageSelectedBoard ? handleDeleteAd : undefined}
                        onMove={canManageSelectedBoard ? handleMoveAd : undefined}
                      />
                    ) : (
                      <Card
                        key={item.id}
                        className="overflow-hidden hover:shadow-xl transition-all duration-300 bg-card border-border cursor-pointer break-inside-avoid"
                        onClick={() => setSelectedBoardId(item.id)}
                      >
                        <div className="p-3 border-b border-border/50 bg-card/50">
                          <div className="text-sm font-semibold text-foreground truncate">{item.name}</div>
                          <div className="text-xs text-muted-foreground">Subboard</div>
                        </div>
                        <div className="p-3 bg-muted/40">
                          <div className="grid grid-cols-3 gap-2">
                            {(subboardPreviewAds[item.id] || []).slice(0, 3).length > 0 ? (
                              (subboardPreviewAds[item.id] || []).slice(0, 3).map((ad) => {
                                const preview = ad.videos?.[0]
                                  ? ad.thumbnailUrl || ad.images?.[1] || ad.images?.[0] || ''
                                  : ad.images?.[1] || ad.images?.[0] || ''

                                return (
                                  <div key={ad._id} className="aspect-[2/3] overflow-hidden rounded-lg bg-muted">
                                    {preview ? (
                                      <img
                                        src={preview}
                                        alt={ad.advertiserName}
                                        className="h-full w-full object-cover"
                                      />
                                    ) : (
                                      <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
                                        No preview
                                      </div>
                                    )}
                                  </div>
                                )
                              })
                            ) : (
                              <div className="col-span-3 text-sm text-muted-foreground">No ads yet</div>
                            )}
                          </div>
                        </div>
                      </Card>
                    )
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <DeleteBoardModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDeleteAd}
        boardName={deleteTarget?.advertiserName || 'this ad'}
        title="Delete Ad"
        description="This will permanently delete this ad."
      />

      <MoveAdModal
        isOpen={Boolean(moveTarget)}
        onClose={() => setMoveTarget(null)}
        onSubmit={confirmMoveAd}
        boards={boards}
        adName={moveTarget?.advertiserName || 'this'}
        currentBoardId={moveTarget?.boardIds?.[0] || null}
      />

      <ShareBoardModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        boardId={selectedBoardId}
        boardName={selectedBoard?.name || 'Selected board'}
        shareToken={shareToken}
      />
    </>
  )
}