'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  Folder,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
  ArrowRightLeft,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import CreateCollectionModal from '@/components/create-collection-modal'
import RenameBoardModal from '@/components/rename-board-modal'
import MoveBoardModal from '@/components/move-board-modal'
import DeleteBoardModal from '@/components/delete-board-modal'
import { useBoards } from '@/components/ui/boards-provider'

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

type BoardActionTarget = {
  _id: string
  name: string
  parentBoardId: string | null
  type: 'parent' | 'subboard'
}

export default function Sidebar() {
  const {
    topLevelBoards,
    getSubboards,
    selectedBoardId,
    setSelectedBoardId,
    createBoard,
    updateBoard,
    deleteBoard,
    moveBoard,
    loading,
  } = useBoards()

  const [expandedCollections, setExpandedCollections] = useState<string[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [forcedParentId, setForcedParentId] = useState<string | null>(null)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)

  const [renameTarget, setRenameTarget] = useState<BoardActionTarget | null>(null)
  const [moveTarget, setMoveTarget] = useState<BoardActionTarget | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<BoardActionTarget | null>(null)

  const menuRef = useRef<HTMLDivElement | null>(null)
  const menuButtonRef = useRef<HTMLButtonElement | null>(null)
  const hasInitializedExpanded = useRef(false)
  
  useEffect(() => {
    if (!hasInitializedExpanded.current && topLevelBoards.length > 0) {
      setExpandedCollections([topLevelBoards[0]._id])
      hasInitializedExpanded.current = true
    }
  }, [topLevelBoards])

  useEffect(() => {
    if (!selectedBoardId) return

    const selectedParent = topLevelBoards.find((board) => board._id === selectedBoardId)
    if (selectedParent) {
      setExpandedCollections((prev) =>
        prev.includes(selectedParent._id) ? prev : [...prev, selectedParent._id]
      )
      return
    }

    const parentWithSelectedChild = topLevelBoards.find((board) =>
      getSubboards(board._id).some((subboard) => subboard._id === selectedBoardId)
    )

    if (parentWithSelectedChild) {
      setExpandedCollections((prev) =>
        prev.includes(parentWithSelectedChild._id)
          ? prev
          : [...prev, parentWithSelectedChild._id]
      )
    }
  }, [selectedBoardId, topLevelBoards, getSubboards])

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

  const handleCreateCollection = async (data: {
    name: string
    parentBoardId: string | null
  }) => {
    const isTopLevel = !data.parentBoardId
    const siblingCount = isTopLevel
      ? topLevelBoards.length
      : getSubboards(data.parentBoardId as string).length

    const newBoard = await createBoard({
      name: data.name,
      slug: slugify(data.name),
      parentBoardId: data.parentBoardId,
      order: siblingCount,
    })

    setSelectedBoardId(newBoard._id)

    if (data.parentBoardId) {
      setExpandedCollections((prev) =>
        prev.includes(data.parentBoardId as string)
          ? prev
          : [...prev, data.parentBoardId as string]
      )
    } else {
      setExpandedCollections((prev) =>
        prev.includes(newBoard._id) ? prev : [...prev, newBoard._id]
      )
    }

    setForcedParentId(null)
  }

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

    setExpandedCollections((prev) =>
      prev.includes(nextParentId) ? prev : [...prev, nextParentId]
    )

    setMoveTarget(null)
    setOpenMenuId(null)
  }

  const filteredCollections = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()

    if (!term) return topLevelBoards

    return topLevelBoards.filter((collection) => {
      const matchesCollection = collection.name.toLowerCase().includes(term)
      const matchesSubboards = getSubboards(collection._id).some((subboard) =>
        subboard.name.toLowerCase().includes(term)
      )

      return matchesCollection || matchesSubboards
    })
  }, [topLevelBoards, getSubboards, searchTerm])

  return (
    <>
      <div className="hidden h-screen flex-col border-r border-border bg-background md:flex md:w-64 lg:w-72">
        <div className="border-b border-border/50 p-4 lg:p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 lg:h-10 lg:w-10">
              <Folder className="h-4 w-4 text-primary lg:h-5 lg:w-5" />
            </div>
            <h1 className="text-base font-semibold text-foreground lg:text-lg">
              Facebook Ads Saver
            </h1>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-3 lg:px-3 lg:py-4">
          {loading ? (
            <div className="px-3 py-2 text-sm text-muted-foreground">Loading collections...</div>
          ) : filteredCollections.length === 0 ? (
            <div className="px-3 py-2 text-sm text-muted-foreground">
              No collections found.
            </div>
          ) : (
            <div className="space-y-1">
              {filteredCollections.map((collection) => {
                const subboards = getSubboards(collection._id)
                const isExpanded = expandedCollections.includes(collection._id)
                const isCollectionSelected = selectedBoardId === collection._id
                const isParentMenuOpen = openMenuId === collection._id

                return (
                  <div
                    key={collection._id}
                    className={`relative ${isParentMenuOpen ? 'z-50' : ''}`}
                  >
                    <div
                      className="group flex w-full items-center gap-2 rounded-lg px-2 py-2 text-xs font-medium transition-all duration-200 lg:px-3 lg:py-2.5 lg:text-sm"
                      style={{
                        backgroundColor: isCollectionSelected
                          ? 'rgba(101, 84, 192, 0.08)'
                          : 'transparent',
                        color: isCollectionSelected
                          ? 'rgb(101, 84, 192)'
                          : 'rgb(63, 63, 70)',
                      }}
                    >
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          if (subboards.length > 0) {
                            setExpandedCollections((prev) =>
                              prev.includes(collection._id)
                                ? prev.filter((id) => id !== collection._id)
                                : [...prev, collection._id]
                            )
                          }
                          setOpenMenuId(null)
                        }}
                        className="flex h-5 w-5 items-center justify-center rounded cursor-pointer hover:bg-primary/10"
                        title={isExpanded ? 'Collapse' : 'Expand'}
                      >
                        {subboards.length > 0 ? (
                          isExpanded ? (
                            <ChevronDown className="h-3 w-3 flex-shrink-0 lg:h-4 lg:w-4" />
                          ) : (
                            <ChevronRight className="h-3 w-3 flex-shrink-0 lg:h-4 lg:w-4" />
                          )
                        ) : (
                          <div className="h-3 w-3 flex-shrink-0 lg:h-4 lg:w-4" />
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedBoardId(collection._id)
                          setOpenMenuId(null)
                        }}
                        className="flex min-w-0 flex-1 items-center gap-3 cursor-pointer text-left"
                      >
                        <Folder className="h-3 w-3 flex-shrink-0 lg:h-4 lg:w-4" />
                        <span className="truncate">{collection.name}</span>
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setForcedParentId(collection._id)
                          setIsModalOpen(true)
                          setOpenMenuId(null)
                        }}
                        className="rounded p-1 opacity-0 transition group-hover:opacity-100 hover:bg-primary/10 cursor-pointer"
                        title="Add subboard"
                        type="button"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>

                      <button
                        ref={isParentMenuOpen ? menuButtonRef : null}
                        onClick={(e) => {
                          e.stopPropagation()
                          setOpenMenuId((prev) => (prev === collection._id ? null : collection._id))
                        }}
                        className="rounded p-1 opacity-0 transition group-hover:opacity-100 hover:bg-primary/10 cursor-pointer"
                        title="Board actions"
                        type="button"
                      >
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {isParentMenuOpen && (
                      <div
                        ref={isParentMenuOpen ? menuRef : null}
                        className="absolute right-2  mt-1 min-w-[160px] rounded-xl border border-border bg-card shadow-lg z-[60] overflow-hidden"
                      >
                        <button
                          onClick={() =>
                            setRenameTarget({
                              _id: collection._id,
                              name: collection.name,
                              parentBoardId: collection.parentBoardId,
                              type: 'parent',
                            })
                          }
                          className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted first:rounded-t-xl last:rounded-b-xl cursor-pointer">                          

                          <Pencil className="h-4 w-4" />
                          Rename
                        </button>
                        <button
                          onClick={() =>
                            setDeleteTarget({
                              _id: collection._id,
                              name: collection.name,
                              parentBoardId: collection.parentBoardId,
                              type: 'parent',
                            })
                          }
                          className="flex w-full items-center gap-2 px-3 py-2 text-sm  text-red-500 hover:bg-muted first:rounded-t-xl last:rounded-b-xl cursor-pointer">
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </button>
                      </div>
                    )}

                    {isExpanded && subboards.length > 0 && (
                      <div className="ml-2 mt-0.5 space-y-0.5 border-l border-border/30 pl-2">
                        {subboards.map((subboard) => {
                          const isSelected = selectedBoardId === subboard._id
                          const isSubboardMenuOpen = openMenuId === subboard._id

                          return (
                            <div
                              key={subboard._id}
                              className={`relative group ${isSubboardMenuOpen ? 'z-50' : 'z-0'}`}
                            >
                              <div
                                className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-xs transition-all duration-200 lg:px-3 lg:py-2 lg:text-sm"
                                style={{
                                  backgroundColor: isSelected
                                    ? 'rgb(101, 84, 192)'
                                    : 'transparent',
                                  color: isSelected ? 'white' : 'rgb(113, 113, 122)',
                                  fontWeight: isSelected ? '600' : '500',
                                }}
                              >
                                <button
                                  onClick={() => {
                                    setSelectedBoardId(subboard._id)
                                    setOpenMenuId(null)
                                  }}
                                  className="flex min-w-0 flex-1 items-center gap-2.5 cursor-pointer"
                                  type="button"
                                >
                                  <Folder className="h-3 w-3 flex-shrink-0 lg:h-3.5 lg:w-3.5" />
                                  <span className="truncate">{subboard.name}</span>
                                </button>

                                <button
                                  ref={isSubboardMenuOpen ? menuButtonRef : null}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setOpenMenuId((prev) =>
                                      prev === subboard._id ? null : subboard._id
                                    )
                                  }}
                                  className="rounded p-1 opacity-0 transition group-hover:opacity-100 hover:bg-black/10 cursor-pointer"
                                  title="Subboard actions"
                                  type="button"
                                >
                                  <MoreHorizontal className="h-3.5 w-3.5" />
                                </button>
                              </div>

                              {isSubboardMenuOpen && (
                                <div
                                  ref={isSubboardMenuOpen ? menuRef : null}
                                  className="absolute right-2 top-full mt-1 min-w-[170px] rounded-xl border border-border bg-card shadow-lg z-[999] overflow-hidden"
                                >
                                  <button
                                    onClick={() =>
                                      setRenameTarget({
                                        _id: subboard._id,
                                        name: subboard.name,
                                        parentBoardId: subboard.parentBoardId,
                                        type: 'subboard',
                                      })
                                    }
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
                                    className="flex w-full items-center gap-2 px-3 py-2 text-sm  text-red-500 hover:bg-muted first:rounded-t-xl last:rounded-b-xl cursor-pointer"
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
                )
              })}
            </div>
          )}
        </div>

        <div className="space-y-3 border-t border-border/50 p-3 lg:p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground lg:left-3 lg:h-4 lg:w-4" />
            <Input
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-8 cursor-text border-border/50 bg-muted/50 pl-7 text-xs text-foreground placeholder:text-muted-foreground focus-visible:ring-primary lg:h-9 lg:pl-9 lg:text-sm"
            />
          </div>

          <Button
            onClick={() => {
              setForcedParentId(null)
              setIsModalOpen(true)
              setOpenMenuId(null)
            }}
            className="h-8 w-full cursor-pointer gap-2 bg-primary text-xs font-medium text-primary-foreground transition-all duration-200 hover:bg-primary/90 lg:h-9 lg:text-sm"
            size="sm"
          >
            <Plus className="h-3 w-3 lg:h-4 lg:w-4" />
            <span className="hidden lg:inline">Add Collection</span>
            <span className="lg:hidden">Add</span>
          </Button>
        </div>
      </div>

      <CreateCollectionModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setForcedParentId(null)
        }}
        onCreateCollection={handleCreateCollection}
        parentBoards={topLevelBoards.map((board) => ({
          _id: board._id,
          name: board.name,
        }))}
        defaultParentBoardId={forcedParentId}
      />

      <RenameBoardModal
        isOpen={Boolean(renameTarget)}
        onClose={() => setRenameTarget(null)}
        boardName={renameTarget?.name || ''}
        title={
          renameTarget?.type === 'parent'
            ? 'Rename Collection'
            : 'Rename Subboard'
        }
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
        title={
          deleteTarget?.type === 'parent'
            ? 'Delete Collection'
            : 'Delete Subboard'
        }
        description={
          deleteTarget?.type === 'parent'
            ? 'This will delete the collection, all subboards inside it, and all ads inside those subboards.'
            : 'This will delete the subboard and all ads inside it.'
        }
        onConfirm={() =>
          deleteTarget ? handleDeleteBoard(deleteTarget._id) : Promise.resolve()
        }
      />
    </>
  )
}