'use client'

import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Board } from '@/components/ui/boards-provider'

interface MoveAdModalProps {
  isOpen: boolean
  adName: string
  boards: Board[]
  currentBoardId: string | null
  onClose: () => void
  onSubmit: (boardId: string) => Promise<void> | void
}

export default function MoveAdModal({
  isOpen,
  adName,
  boards,
  currentBoardId,
  onClose,
  onSubmit,
}: MoveAdModalProps) {
  const [query, setQuery] = useState('')
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({})
  const [selectedBoardId, setSelectedBoardId] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const childrenByParent = useMemo(() => {
    const map: Record<string, Board[]> = {}
    for (const board of boards) {
      const key = board.parentBoardId || 'root'
      if (!map[key]) map[key] = []
      map[key].push(board)
    }
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => a.name.localeCompare(b.name))
    }
    return map
  }, [boards])

  const normalizedQuery = query.trim().toLowerCase()

  const boardById = useMemo(() => {
    const map: Record<string, Board> = {}
    for (const board of boards) map[board._id] = board
    return map
  }, [boards])

  const getDepth = (boardId: string) => {
    let depth = 0
    let current = boardById[boardId]
    while (current?.parentBoardId) {
      depth += 1
      current = boardById[current.parentBoardId]
      if (depth > 20) break
    }
    return depth
  }

  const hasMatchingDescendant = (boardId: string): boolean => {
    const children = childrenByParent[boardId] || []
    for (const child of children) {
      if (child.name.toLowerCase().includes(normalizedQuery)) return true
      if (hasMatchingDescendant(child._id)) return true
    }
    return false
  }

  const visibleBoardIds = useMemo(() => {
    const result: string[] = []
    const walk = (parentId: string) => {
      const children = childrenByParent[parentId] || []
      for (const child of children) {
        const selfMatch = !normalizedQuery || child.name.toLowerCase().includes(normalizedQuery)
        const descendantMatch = !normalizedQuery || hasMatchingDescendant(child._id)
        if (selfMatch || descendantMatch) {
          result.push(child._id)
          walk(child._id)
        }
      }
    }
    walk('root')
    return result
  }, [childrenByParent, normalizedQuery])

  useEffect(() => {
    if (!isOpen) return
    setQuery('')
    setSelectedBoardId(currentBoardId || '')
    setIsSubmitting(false)
    const nextExpanded: Record<string, boolean> = {}
    for (const board of boards) {
      nextExpanded[board._id] = true
    }
    setExpandedNodes(nextExpanded)
  }, [isOpen, currentBoardId, boards])

  if (!isOpen) return null

  const toggleNode = (boardId: string) => {
    setExpandedNodes((prev) => ({ ...prev, [boardId]: !prev[boardId] }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedBoardId || isSubmitting) return
    try {
      setIsSubmitting(true)
      await onSubmit(selectedBoardId)
      onClose()
    } finally {
      setIsSubmitting(false)
    }
  }

  const canSubmit = Boolean(selectedBoardId) && selectedBoardId !== currentBoardId && !isSubmitting

  const getBoardPath = (boardId: string) => {
    const parts: string[] = []
    let current: Board | undefined = boardById[boardId]
    while (current) {
      parts.unshift(current.name)
      current = current.parentBoardId ? boardById[current.parentBoardId] : undefined
      if (parts.length > 30) break
    }
    return parts.join(' / ')
  }

  const renderBoardRow = (board: Board) => {
    const depth = getDepth(board._id)
    const hasChildren = (childrenByParent[board._id] || []).length > 0
    const expanded = expandedNodes[board._id] !== false
    const isSelected = selectedBoardId === board._id
    const isCurrent = currentBoardId === board._id

    return (
      <div key={board._id} className="space-y-1">
        <div className="flex items-center">
          {hasChildren ? (
            <button
              type="button"
              onClick={() => toggleNode(board._id)}
              className="mr-1 cursor-pointer rounded p-1 text-violet-700 hover:bg-muted"
              style={{ marginLeft: depth * 14 }}
            >
              {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            </button>
          ) : (
            <span style={{ marginLeft: depth * 14 + 26 }} />
          )}

          <button
            type="button"
            onClick={() => setSelectedBoardId(board._id)}
            className={`cursor-pointer flex-1 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors ${
              isSelected ? 'bg-violet-100 text-violet-900' : 'text-foreground hover:bg-muted'
            }`}
          >
            <span className="font-medium">{board.name}</span>
            {isCurrent && <span className="ml-2 text-xs text-muted-foreground">(current)</span>}
            <div className="text-[11px] text-muted-foreground">{getBoardPath(board._id)}</div>
          </button>
        </div>

        {hasChildren && expanded && (childrenByParent[board._id] || [])
          .filter((child) => visibleBoardIds.includes(child._id))
          .map((child) => renderBoardRow(child))}
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/45 p-4">
      <div className="w-full max-w-xl rounded-2xl border border-border bg-card p-4 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="truncate pr-3 text-2xl font-semibold text-violet-700">Move {adName} ad</h2>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-md p-1 text-violet-700 hover:bg-muted"
            aria-label="Close"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter boards..."
            className="mb-3 h-10 w-full rounded-xl border border-violet-200 bg-background px-3 text-base outline-none"
          />

          <div className="max-h-[300px] space-y-1 overflow-y-auto pr-1">
            {(childrenByParent.root || [])
              .filter((board) => visibleBoardIds.includes(board._id))
              .map((board) => renderBoardRow(board))}
          </div>

          <Button
            type="submit"
            disabled={!canSubmit}
            className={`mt-4 h-10 w-full text-base font-semibold text-white transition-colors ${
              canSubmit
                ? 'cursor-pointer bg-violet-600 hover:bg-violet-700'
                : 'cursor-not-allowed bg-violet-300/80'
            }`}
          >
            {isSubmitting ? 'Moving...' : 'Move'}
          </Button>
        </form>
      </div>
    </div>
  )
}
