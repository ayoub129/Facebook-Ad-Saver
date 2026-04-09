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
  GripVertical,
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

type FlatBoard = {
  _id: string
  name: string
  parentBoardId: string | null
  order?: number
}

type DragItem =
  | { type: 'ad'; id: string }
  | { type: 'board'; id: string }

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

  const [expandedBoardIds, setExpandedBoardIds] = useState<string[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [forcedParentId, setForcedParentId] = useState<string | null>(null)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)

  const [renameTarget, setRenameTarget] = useState<BoardActionTarget | null>(null)
  const [moveTarget, setMoveTarget] = useState<BoardActionTarget | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<BoardActionTarget | null>(null)

  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [dragOverPosition, setDragOverPosition] = useState<'inside' | null>(null)
  const [draggingBoardId, setDraggingBoardId] = useState<string | null>(null)

  const menuRef = useRef<HTMLDivElement | null>(null)
  const menuButtonRef = useRef<HTMLButtonElement | null>(null)
  const hasInitializedExpanded = useRef(false)

  const allBoards = useMemo<FlatBoard[]>(() => {
    const result: FlatBoard[] = []

    const walk = (boards: FlatBoard[]) => {
      boards.forEach((board) => {
        result.push(board)
        const children = getSubboards(board._id) as FlatBoard[]
        if (children.length > 0) {
          walk(children)
        }
      })
    }

    walk(topLevelBoards as FlatBoard[])
    return result
  }, [topLevelBoards, getSubboards])

  const boardMap = useMemo(() => {
    return new Map(allBoards.map((board) => [board._id, board]))
  }, [allBoards])

  const getDescendantIds = (boardId: string): string[] => {
    const descendants: string[] = []

    const walk = (parentId: string) => {
      const children = getSubboards(parentId) as FlatBoard[]
      for (const child of children) {
        descendants.push(child._id)
        walk(child._id)
      }
    }

    walk(boardId)
    return descendants
  }

  const isDescendantOf = (candidateId: string, ancestorId: string) => {
    return getDescendantIds(ancestorId).includes(candidateId)
  }

  const getBoardDepth = (boardId: string) => {
    let depth = 0
    let current = boardMap.get(boardId)

    while (current?.parentBoardId) {
      depth += 1
      current = boardMap.get(current.parentBoardId)
    }

    return depth
  }

  const toggleExpanded = (boardId: string) => {
    setExpandedBoardIds((prev) =>
      prev.includes(boardId)
        ? prev.filter((id) => id !== boardId)
        : [...prev, boardId]
    )
  }

  useEffect(() => {
    if (!hasInitializedExpanded.current && topLevelBoards.length > 0) {
      setExpandedBoardIds([topLevelBoards[0]._id])
      hasInitializedExpanded.current = true
    }
  }, [topLevelBoards])

  useEffect(() => {
    if (!selectedBoardId) return

    const chain: string[] = []
    let current = boardMap.get(selectedBoardId)

    while (current?.parentBoardId) {
      chain.push(current.parentBoardId)
      current = boardMap.get(current.parentBoardId)
    }

    if (chain.length > 0) {
      setExpandedBoardIds((prev) => Array.from(new Set([...prev, ...chain])))
    }
  }, [selectedBoardId, boardMap])

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
    const siblingCount = data.parentBoardId
      ? getSubboards(data.parentBoardId).length
      : topLevelBoards.length

    const newBoard = await createBoard({
      name: data.name,
      slug: slugify(data.name),
      parentBoardId: data.parentBoardId,
      order: siblingCount,
    })

    setSelectedBoardId(newBoard._id)

    if (data.parentBoardId) {
      setExpandedBoardIds((prev) =>
        prev.includes(data.parentBoardId as string)
          ? prev
          : [...prev, data.parentBoardId as string]
      )
    } else {
      setExpandedBoardIds((prev) =>
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

  const handleMoveBoard = async (boardId: string, nextParentId: string | null) => {
    await moveBoard(boardId, nextParentId)

    if (nextParentId) {
      setExpandedBoardIds((prev) =>
        prev.includes(nextParentId) ? prev : [...prev, nextParentId]
      )
    }

    setMoveTarget(null)
    setOpenMenuId(null)
  }

  const matchesSearch = (board: FlatBoard, term: string): boolean => {
    if (!term) return true
    if (board.name.toLowerCase().includes(term)) return true

    const children = getSubboards(board._id) as FlatBoard[]
    return children.some((child) => matchesSearch(child, term))
  }

  const filteredCollections = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    if (!term) return topLevelBoards as FlatBoard[]
    return (topLevelBoards as FlatBoard[]).filter((board) => matchesSearch(board, term))
  }, [topLevelBoards, searchTerm])

  const getMoveParentOptions = useMemo(() => {
    return allBoards.map((board) => ({
      _id: board._id,
      name: `${'— '.repeat(getBoardDepth(board._id))}${board.name}`,
    }))
  }, [allBoards, boardMap])

  const onBoardDragStart = (e: React.DragEvent, boardId: string) => {
    const payload: DragItem = { type: 'board', id: boardId }
    e.dataTransfer.setData('application/json', JSON.stringify(payload))
    e.dataTransfer.setData('boardId', boardId)
    e.dataTransfer.effectAllowed = 'move'
    setDraggingBoardId(boardId)
    setOpenMenuId(null)
  }

  const onBoardDragEnd = () => {
    setDraggingBoardId(null)
    setDragOverId(null)
    setDragOverPosition(null)
  }

  const parseDragItem = (e: React.DragEvent): DragItem | null => {
    try {
      const json = e.dataTransfer.getData('application/json')
      if (json) return JSON.parse(json) as DragItem
    } catch {}

    const adId = e.dataTransfer.getData('adId')
    if (adId) return { type: 'ad', id: adId }

    const boardId = e.dataTransfer.getData('boardId')
    if (boardId) return { type: 'board', id: boardId }

    return null
  }

  const handleDropOnBoard = async (e: React.DragEvent, targetBoard: FlatBoard) => {
    e.preventDefault()
    e.stopPropagation()

    const dragItem = parseDragItem(e)
    setDragOverId(null)
    setDragOverPosition(null)

    if (!dragItem) return

    if (dragItem.type === 'ad') {
      try {
        await fetch(`/api/ads/${dragItem.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            boardId: targetBoard._id,
          }),
        })

        setSelectedBoardId(targetBoard._id)
        setExpandedBoardIds((prev) =>
          prev.includes(targetBoard._id) ? prev : [...prev, targetBoard._id]
        )
      } catch (err) {
        console.error('Move ad failed', err)
      }
      return
    }

    if (dragItem.type === 'board') {
      const draggedBoardId = dragItem.id

      if (draggedBoardId === targetBoard._id) return
      if (isDescendantOf(targetBoard._id, draggedBoardId)) return

      try {
        await moveBoard(draggedBoardId, targetBoard._id)
        setExpandedBoardIds((prev) =>
          prev.includes(targetBoard._id) ? prev : [...prev, targetBoard._id]
        )
      } catch (err) {
        console.error('Move board failed', err)
      }
    }
  }

  const renderBoardTree = (board: FlatBoard, depth = 0) => {
    const children = getSubboards(board._id) as FlatBoard[]
    const isExpanded = expandedBoardIds.includes(board._id)
    const isSelected = selectedBoardId === board._id
    const isMenuOpen = openMenuId === board._id
    const isDragging = draggingBoardId === board._id
    const isDragOver = dragOverId === board._id && dragOverPosition === 'inside'

    const leftPadding = 4 
    const childIndentClass =
      depth === 0
        ? 'ml-4 border-l border-border/30 pl-2'
        : depth === 1
        ? 'ml-6 border-l border-border/25 pl-2'
        : 'ml-8 border-l border-border/20 pl-2'

    return (
      <div
        key={board._id}
        className={`relative ${isMenuOpen ? 'z-50' : ''}`}
      >
        <div
          draggable
          onDragStart={(e) => onBoardDragStart(e, board._id)}
          onDragEnd={onBoardDragEnd}
          onDragOver={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setDragOverId(board._id)
            setDragOverPosition('inside')
          }}
          onDragLeave={(e) => {
            const related = e.relatedTarget as Node | null
            if (related && (e.currentTarget as HTMLElement).contains(related)) return
            setDragOverId((prev) => (prev === board._id ? null : prev))
            setDragOverPosition(null)
          }}
          onDrop={(e) => handleDropOnBoard(e, board)}
          className={`
            group relative flex w-full items-center gap-2 rounded-xl py-2 text-xs font-medium
            transition-all duration-200 lg:text-sm
            ${isDragging ? 'opacity-40' : ''}
            ${isDragOver ? 'scale-[1.015]' : ''}
          `}
          style={{
            paddingLeft: `${leftPadding}px`,
            paddingRight: '8px',
            backgroundColor: isSelected
              ? 'rgba(101, 84, 192, 0.18)'
              : isDragOver
              ? 'rgba(101, 84, 192, 0.12)'
              : 'transparent',
            color: isSelected ? 'rgb(101, 84, 192)' : 'rgb(63, 63, 70)',
            boxShadow: isDragOver
              ? '0 0 0 1px rgba(101, 84, 192, 0.35), 0 10px 30px rgba(101, 84, 192, 0.12)'
              : 'none',
          }}
        >
          {isDragOver && (
            <div className="pointer-events-none absolute inset-0 rounded-xl border border-primary/50 bg-primary/5" />
          )}

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              if (children.length > 0) {
                toggleExpanded(board._id)
              }
              setOpenMenuId(null)
            }}
            className={children.length > 0 ? "relative z-10 flex h-5 w-5 items-center justify-center rounded cursor-pointer hover:bg-primary/10" : "relative z-10 flex h-5 w-5 items-center justify-center rounded" }
            title={isExpanded ? 'Collapse' : 'Expand'}
          >
            {children.length > 0 ? (
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
              setSelectedBoardId(board._id)
              setOpenMenuId(null)
            }}
            className="relative z-10 flex min-w-0 flex-1 items-center gap-2.5 cursor-pointer text-left"
          >
            {/* <GripVertical className={isDragging ? "h-3.5 w-3.5 flex-shrink-0 text-muted-foreground/70 opacity-0 transition group-hover:opacity-100 cursor-grabbing" : "h-3.5 w-3.5 flex-shrink-0 text-muted-foreground/70 opacity-0 transition group-hover:opacity-100 cursor-grab"} /> */}
            <Folder className="h-3 w-3 flex-shrink-0 lg:h-4 lg:w-4" />
            <span className="truncate">{board.name}</span>
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation()
              setForcedParentId(board._id)
              setIsModalOpen(true)
              setOpenMenuId(null)
              setExpandedBoardIds((prev) =>
                prev.includes(board._id) ? prev : [...prev, board._id]
              )
            }}
            className="relative z-10 rounded p-1 opacity-0 transition group-hover:opacity-100 hover:bg-primary/10 cursor-pointer"
            title="Add child board"
            type="button"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>

          <button
            ref={isMenuOpen ? menuButtonRef : null}
            onClick={(e) => {
              e.stopPropagation()
              setOpenMenuId((prev) => (prev === board._id ? null : board._id))
            }}
            className="relative z-10 rounded p-1 opacity-0 transition group-hover:opacity-100 hover:bg-primary/10 cursor-pointer"
            title="Board actions"
            type="button"
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </button>
        </div>

        {isMenuOpen && (
          <div
            ref={isMenuOpen ? menuRef : null}
            className="absolute right-2 top-full mt-1 min-w-[170px] overflow-hidden rounded-xl border border-border bg-card shadow-lg z-[999]"
          >
            <button
              onClick={() =>
                setRenameTarget({
                  _id: board._id,
                  name: board.name,
                  parentBoardId: board.parentBoardId,
                  type: board.parentBoardId ? 'subboard' : 'parent',
                })
              }
              className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted cursor-pointer"
            >
              <Pencil className="h-4 w-4" />
              Rename
            </button>

            <button
              onClick={() =>
                setMoveTarget({
                  _id: board._id,
                  name: board.name,
                  parentBoardId: board.parentBoardId,
                  type: board.parentBoardId ? 'subboard' : 'parent',
                })
              }
              className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted cursor-pointer"
            >
              <ArrowRightLeft className="h-4 w-4" />
              Move
            </button>

            <button
              onClick={() =>
                setDeleteTarget({
                  _id: board._id,
                  name: board.name,
                  parentBoardId: board.parentBoardId,
                  type: board.parentBoardId ? 'subboard' : 'parent',
                })
              }
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-muted cursor-pointer"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </button>
          </div>
        )}

        {isExpanded && children.length > 0 && (
          <div className={`mt-0.5 space-y-0.5 ${childIndentClass}`}>
            {children.map((child) => renderBoardTree(child, depth + 1))}
          </div>
        )}
      </div>
    )
  }

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
              {filteredCollections.map((collection) => renderBoardTree(collection as FlatBoard, 0))}
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
        parentBoards={allBoards.map((board) => ({
          _id: board._id,
          name: `${'— '.repeat(getBoardDepth(board._id))}${board.name}`,
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
        parentBoards={getMoveParentOptions.filter((board) => {
          if (!moveTarget) return true
          if (board._id === moveTarget._id) return false
          if (isDescendantOf(board._id, moveTarget._id)) return false
          return true
        })}
        onSubmit={(nextParentId) =>
          moveTarget ? handleMoveBoard(moveTarget._id, nextParentId) : Promise.resolve()
        }
      />

      <DeleteBoardModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        boardName={deleteTarget?.name || ''}
        title={
          deleteTarget?.type === 'parent'
            ? 'Delete Board'
            : 'Delete Subboard'
        }
        description="This will delete the selected board, all nested boards inside it, and any ads saved in them."
        onConfirm={() =>
          deleteTarget ? handleDeleteBoard(deleteTarget._id) : Promise.resolve()
        }
      />
    </>
  )
}