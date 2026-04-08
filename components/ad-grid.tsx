'use client'

import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, LogOut, User } from 'lucide-react'
import { signOut } from 'next-auth/react'
import { Input } from '@/components/ui/input'
import AdCard, { type DashboardAd } from './ad-card'
import { useBoards } from '@/components/ui/boards-provider'
import DeleteBoardModal from '@/components/delete-board-modal'

interface AdGridProps {
  onAdClick: (adId: string) => void
}

type BreadcrumbItem = {
  _id: string
  name: string
}

type AdItem = DashboardAd

export default function AdGrid({ onAdClick }: AdGridProps) {
  const {
    boards,
    selectedBoardId,
    setSelectedBoardId,
    selectedBoard,
  } = useBoards()

  const [ads, setAds] = useState<AdItem[]>([])
  const [loadingAds, setLoadingAds] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState('recent')
  const [showSortMenu, setShowSortMenu] = useState(false)
  const [playingVideoId, setPlayingVideoId] = useState<string | null>(null)
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [columns, setColumns] = useState<DashboardAd[][]>([])
  const [deleteTarget, setDeleteTarget] = useState<AdItem | null>(null)
  const [isSigningOut, setIsSigningOut] = useState(false)

  // 🔥 NEW
  const [columnsCount, setColumnsCount] = useState(4)

  const handleDeleteAd = (adId: string) => {
    const ad = ads.find((item) => item._id === adId)
    if (!ad) return
    setDeleteTarget(ad)
  }

  const confirmDeleteAd = async () => {
    if (!deleteTarget) return

    try {
      const res = await fetch(`/api/ads/${deleteTarget._id}`, {
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
      alert('Failed to delete ad')
      throw error
    }
  }

  const handleSignOut = async () => {
    try {
      setIsSigningOut(true)
      setShowProfileMenu(false)
      await signOut({ callbackUrl: '/login' })
    } catch (error) {
      console.error('Sign out failed:', error)
      alert('Failed to sign out')
    } finally {
      setIsSigningOut(false)
    }
  }

  useEffect(() => {
    const fetchAds = async () => {
      try {
        if (!selectedBoardId || !selectedBoard || !selectedBoard.parentBoardId) {
          setAds([])
          return
        }

        setLoadingAds(true)

        const res = await fetch(`/api/ads?boardId=${encodeURIComponent(selectedBoardId)}`, {
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

  // 🔥 UPDATED: dynamic columns
  useEffect(() => {
    const cols: DashboardAd[][] = Array.from({ length: columnsCount }, () => [])

    filteredAds.forEach((ad, index) => {
      cols[index % columnsCount].push(ad)
    })

    setColumns(cols)
  }, [filteredAds, columnsCount])

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
          ) : filteredAds.length === 0 ? (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              No ads yet
            </div>
          ) : (
            <div className="flex gap-5 w-full">
              {columns.map((col, colIndex) => (
                <div key={colIndex} className="flex flex-col gap-5 flex-1">
                  {col.map((ad) => (
                    <AdCard
                      key={ad._id}
                      ad={ad}
                      isPlaying={playingVideoId === ad._id}
                      onVideoPlay={() => handleVideoPlay(ad._id)}
                      onVideoPause={handleVideoPause}
                      onClick={() => onAdClick(ad._id)}
                      onDelete={handleDeleteAd}
                    />
                  ))}
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
    </>
  )
}