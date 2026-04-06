'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Folder, MoreHorizontal, Pencil, Trash2, ArrowRightLeft } from 'lucide-react'
import { useBoards } from '@/components/ui/boards-provider'
import RenameBoardModal from '@/components/rename-board-modal'
import MoveBoardModal from '@/components/move-board-modal'
import DeleteBoardModal from '@/components/delete-board-modal'

type DashboardAd = {
  _id: string
  boardIds: string[]
  advertiserName: string
  images: string[]
  videos: string[]
  thumbnailUrl: string
}

type BoardActionTarget = {
  _id: string
  name: string
  parentBoardId: string | null
  type: 'subboard'
}

interface BoardOverviewProps {
  parentBoardId: string
  onOpenSubboard: (subboardId: string) => void
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

export default function BoardOverview({
  parentBoardId,
  onOpenSubboard,
}: BoardOverviewProps) {
  const { boards, topLevelBoards, getSubboards, updateBoard, deleteBoard, moveBoard } =
    useBoards()

  const [ads, setAds] = useState<DashboardAd[]>([])
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)

  const [renameTarget, setRenameTarget] = useState<BoardActionTarget | null>(null)
  const [moveTarget, setMoveTarget] = useState<BoardActionTarget | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<BoardActionTarget | null>(null)

  const menuRef = useRef<HTMLDivElement | null>(null)
  const menuButtonRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    const fetchAds = async () => {
      try {
        const res = await fetch('/api/ads', { cache: 'no-store' })
        const data = await res.json()

        if (res.ok && data?.success) {
          setAds(Array.isArray(data.ads) ? data.ads : [])
        } else {
          setAds([])
        }
      } catch {
        setAds([])
      }
    }

    fetchAds()
  }, [])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!openMenuId) return

      const target = event.target as Node

      if (menuRef.current?.contains(target)) return
      if (menuButtonRef.current?.contains(target)) return

      setOpenMenuId(null)
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [openMenuId])

  const parentBoard = useMemo(
    () => boards.find((board) => board._id === parentBoardId) || null,
    [boards, parentBoardId]
  )

  const subboards = useMemo(() => getSubboards(parentBoardId), [getSubboards, parentBoardId])

  const handleRenameBoard = async (boardId: string, nextName: string) => {
    await updateBoard(boardId, {
      name: nextName,
      slug: slugify(nextName),
    })

    setRenameTarget(null)
    setOpenMenuId(null)
  }

  const handleDeleteBoard = async (boardId: string) => {
    await deleteBoard(boardId)

    setDeleteTarget(null)
    setOpenMenuId(null)
  }

  const handleMoveSubboard = async (boardId: string, nextParentId: string) => {
    await moveBoard(boardId, nextParentId)

    setMoveTarget(null)
    setOpenMenuId(null)
  }

  return (
    <>
      <div className="flex h-screen flex-1 min-w-0 flex-col bg-background">
        <div className="border-b border-border bg-background px-6 py-4">
          <div className="flex items-center gap-3">
            <Folder className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">{parentBoard?.name || 'Board'}</h2>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-hidden px-6 py-6">
          {subboards.length === 0 ? (
            <div className="text-muted-foreground">No subboards yet</div>
          ) : (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {subboards.map((subboard) => {
                const subboardAds = ads
                  .filter((ad) => ad.boardIds.includes(subboard._id))
                  .slice(0, 2)

                const isMenuOpen = openMenuId === subboard._id

                return (
                  <div
                    key={subboard._id}
                    className={`relative ${isMenuOpen ? 'z-50' : ''}`}
                  >
                    <button
                      onClick={() => {
                        setOpenMenuId(null)
                        onOpenSubboard(subboard._id)
                      }}
                      className="w-full rounded-2xl border border-border bg-card p-4 text-left shadow-sm transition hover:shadow-md cursor-pointer"
                      type="button"
                    >
                      <div className="mb-4 flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-base font-semibold">{subboard.name}</h3>
                          <p className="text-sm text-muted-foreground">View board</p>
                        </div>

                        <button
                          ref={isMenuOpen ? menuButtonRef : null}
                          onClick={(e) => {
                            e.stopPropagation()
                            setOpenMenuId((prev) => (prev === subboard._id ? null : subboard._id))
                          }}
                          className="rounded-full p-2 hover:bg-muted cursor-pointer"
                          type="button"
                          title="Subboard actions"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="flex gap-2">
                        {subboardAds.length > 0 ? (
                          subboardAds.map((ad) => {
                            const preview = ad.videos?.[0]
                              ? ad.thumbnailUrl || ad.images?.[1] || ad.images?.[0] || ''
                              : ad.images?.[1] || ad.images?.[0] || ''

                            return (
                              <div
                                key={ad._id}
                                className="h-24 w-16 overflow-hidden rounded-lg bg-muted"
                              >
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
                          <div className="text-sm text-muted-foreground">No ads yet</div>
                        )}
                      </div>
                    </button>

                    {isMenuOpen && (
                      <div
                        ref={isMenuOpen ? menuRef : null}
                        className="absolute right-4 top-16 min-w-[170px] rounded-xl border border-border bg-card shadow-lg overflow-hidden z-[999]">
                        <button
                          onClick={() =>
                            setRenameTarget({
                              _id: subboard._id,
                              name: subboard.name,
                              parentBoardId: subboard.parentBoardId,
                              type: 'subboard',
                            })
                          }
                          type='button'
className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted first:rounded-t-xl last:rounded-b-xl cursor-pointer">                          
                        
                          <Pencil className="h-4 w-4" />
                          Rename
                        </button>

                        <button
                          onClick={() =>
                            setMoveTarget({
                              _id: subboard._id,
                              name: subboard.name,
                              parentBoardId: subboard.parentBoardId,
                              type: 'subboard',
                            })
                          }
                          type="button"
className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted first:rounded-t-xl last:rounded-b-xl cursor-pointer">                          
                        
                          <ArrowRightLeft className="h-4 w-4" />
                          Move
                        </button>

                        <button
                          onClick={() =>
                            setDeleteTarget({
                              _id: subboard._id,
                              name: subboard.name,
                              parentBoardId: subboard.parentBoardId,
                              type: 'subboard',
                            })
                          }
                          className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-muted cursor-pointer"
                          type="button"
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <RenameBoardModal
        isOpen={Boolean(renameTarget)}
        onClose={() => setRenameTarget(null)}
        boardName={renameTarget?.name || ''}
        title="Rename Subboard"
        onSubmit={(nextName) =>
          renameTarget ? handleRenameBoard(renameTarget._id, nextName) : Promise.resolve()
        }
      />

      <MoveBoardModal
        isOpen={Boolean(moveTarget)}
        onClose={() => setMoveTarget(null)}
        boardName={moveTarget?.name || ''}
        currentParentBoardId={moveTarget?.parentBoardId || null}
        parentBoards={topLevelBoards.map((board) => ({
          _id: board._id,
          name: board.name,
        }))}
        onSubmit={(nextParentId) =>
          moveTarget ? handleMoveSubboard(moveTarget._id, nextParentId) : Promise.resolve()
        }
      />

      <DeleteBoardModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        boardName={deleteTarget?.name || ''}
        title="Delete Subboard"
        description="This will delete the subboard and all ads inside it."
        onConfirm={() =>
          deleteTarget ? handleDeleteBoard(deleteTarget._id) : Promise.resolve()
        }
      />
    </>
  )
}