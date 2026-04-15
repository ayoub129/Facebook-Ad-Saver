'use client'

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'

export type Board = {
  _id: string
  name: string
  slug: string
  parentBoardId: string | null
  order: number
  createdAt?: string
  updatedAt?: string
  source: string
  accessRole?: 'owner' | 'editor' | 'viewer' | 'none'
  accessSource?: 'owner' | 'private_share' | 'public_link' | 'none'
  isOwnedByMe?: boolean
  isSharedWithMe?: boolean
}

type CreateBoardInput = {
  name: string
  slug: string
  parentBoardId?: string | null
  order?: number
}

type UpdateBoardInput = {
  name?: string
  slug?: string
  parentBoardId?: string | null
  order?: number
}

type BoardsContextType = {
  boards: Board[]
  loading: boolean
  error: string | null
  selectedBoardId: string | null
  setSelectedBoardId: (id: string | null) => void
  refreshBoards: () => Promise<void>
  createBoard: (data: CreateBoardInput) => Promise<Board>
  updateBoard: (boardId: string, data: UpdateBoardInput) => Promise<Board>
  deleteBoard: (boardId: string) => Promise<void>
  moveBoard: (boardId: string, newParentBoardId: string | null) => Promise<Board>
  selectedBoard: Board | null
  topLevelBoards: Board[]
  getSubboards: (parentId: string) => Board[]
}

const BoardsContext = createContext<BoardsContextType | null>(null)

export function BoardsProvider({ children }: { children: React.ReactNode }) {
  const [boards, setBoards] = useState<Board[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null)
  const [shareToken, setShareToken] = useState<string | null>(null)
  const [requestedBoardId, setRequestedBoardId] = useState<string | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    setShareToken(params.get('shareToken'))
    setRequestedBoardId(params.get('boardId'))
  }, [])

  const withShareToken = (path: string) => {
    if (!shareToken) return path
    const hasQuery = path.includes('?')
    const encoded = encodeURIComponent(shareToken)
    return `${path}${hasQuery ? '&' : '?'}shareToken=${encoded}`
  }

  const refreshBoards = async () => {
    try {
      setLoading(true)
      setError(null)

      const res = await fetch(withShareToken('/api/boards'), {
        method: 'GET',
        cache: 'no-store',
      })

      let data: any = null

      try {
        data = await res.json()
      } catch {
        throw new Error('Invalid JSON response from /api/boards')
      }

      if (!res.ok) {
        throw new Error(data?.message || `Request failed with status ${res.status}`)
      }

      if (!data?.success) {
        throw new Error(data?.message || 'Failed to fetch boards')
      }

      const nextBoards = Array.isArray(data.boards) ? data.boards : []
      setBoards(nextBoards)

      setSelectedBoardId((current) => {
        if (requestedBoardId && nextBoards.some((board: Board) => board._id === requestedBoardId)) {
          return requestedBoardId
        }
        if (current && nextBoards.some((board: Board) => board._id === current)) {
          return current
        }

        const firstBoard = nextBoards.find((board: Board) => board.parentBoardId === null)
        return firstBoard?._id || null
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch boards'
      setError(message)
      console.error('Failed to fetch boards:', err)
    } finally {
      setLoading(false)
    }
  }

  const collectDescendantIds = (list: Board[], rootId: string) => {
    const childrenByParent = new Map<string, string[]>()
    for (const board of list) {
      if (!board.parentBoardId) continue
      const parent = board.parentBoardId
      if (!childrenByParent.has(parent)) childrenByParent.set(parent, [])
      childrenByParent.get(parent)?.push(board._id)
    }

    const visited = new Set<string>([rootId])
    const queue = [rootId]

    while (queue.length > 0) {
      const current = queue.shift() as string
      const children = childrenByParent.get(current) || []
      for (const childId of children) {
        if (visited.has(childId)) continue
        visited.add(childId)
        queue.push(childId)
      }
    }

    return visited
  }

  const createBoard = async (payload: CreateBoardInput) => {
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const optimisticBoard: Board = {
      _id: tempId,
      name: payload.name,
      slug: payload.slug,
      parentBoardId: payload.parentBoardId ?? null,
      order: payload.order ?? 0,
      source: 'app',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    setBoards((prev) => [...prev, optimisticBoard])

    const res = await fetch(withShareToken('/api/boards'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    const result = await res.json().catch(() => null)

    if (!res.ok || !result?.success) {
      setBoards((prev) => prev.filter((board) => board._id !== tempId))
      throw new Error(result?.message || 'Failed to create board')
    }

    const createdBoard = result.board as Board
    setBoards((prev) =>
      prev.map((board) => (board._id === tempId ? createdBoard : board))
    )
    return createdBoard
  }

  const updateBoard = async (boardId: string, payload: UpdateBoardInput) => {
    let previousBoards: Board[] = []
    setBoards((prev) => {
      previousBoards = prev
      return prev.map((board) =>
        board._id === boardId
          ? {
              ...board,
              ...(payload.name !== undefined ? { name: payload.name } : {}),
              ...(payload.slug !== undefined ? { slug: payload.slug } : {}),
              ...(payload.parentBoardId !== undefined ? { parentBoardId: payload.parentBoardId } : {}),
              ...(payload.order !== undefined ? { order: payload.order } : {}),
              updatedAt: new Date().toISOString(),
            }
          : board
      )
    })

    const res = await fetch(withShareToken(`/api/boards/${boardId}`), {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    const result = await res.json().catch(() => null)

    if (!res.ok || !result?.success) {
      setBoards(previousBoards)
      throw new Error(result?.message || 'Failed to update board')
    }

    const updatedBoard = result.board as Board
    setBoards((prev) =>
      prev.map((board) => (board._id === boardId ? { ...board, ...updatedBoard } : board))
    )
    return updatedBoard
  }

  const deleteBoard = async (boardId: string) => {
    let previousBoards: Board[] = []
    setBoards((prev) => {
      previousBoards = prev
      const idsToDelete = collectDescendantIds(prev, boardId)
      const next = prev.filter((board) => !idsToDelete.has(board._id))
      setSelectedBoardId((current) => (current && idsToDelete.has(current) ? null : current))
      return next
    })

    const res = await fetch(withShareToken(`/api/boards/${boardId}`), {
      method: 'DELETE',
    })

    const result = await res.json().catch(() => null)

    if (!res.ok || !result?.success) {
      setBoards(previousBoards)
      throw new Error(result?.message || 'Failed to delete board')
    }
  }

  const moveBoard = async (boardId: string, newParentBoardId: string | null) => {
    let previousBoards: Board[] = []
    setBoards((prev) => {
      previousBoards = prev
      const destinationSiblings = prev
        .filter((board) => board.parentBoardId === newParentBoardId && board._id !== boardId)
        .sort((a, b) => a.order - b.order)
      const nextOrder = destinationSiblings.length

      return prev.map((board) =>
        board._id === boardId
          ? {
              ...board,
              parentBoardId: newParentBoardId,
              order: nextOrder,
              updatedAt: new Date().toISOString(),
            }
          : board
      )
    })

    const res = await fetch(withShareToken(`/api/boards/${boardId}`), {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        parentBoardId: newParentBoardId,
      }),
    })

    const result = await res.json().catch(() => null)

    if (!res.ok || !result?.success) {
      setBoards(previousBoards)
      throw new Error(result?.message || 'Failed to move board')
    }

    const movedBoard = result.board as Board
    setBoards((prev) =>
      prev.map((board) => (board._id === boardId ? { ...board, ...movedBoard } : board))
    )
    return movedBoard
  }

  const { status } = useSession()
  useEffect(() => {
    if (status === 'authenticated' || (status === 'unauthenticated' && shareToken)) {
      refreshBoards()
    }
  }, [status, shareToken])
  


  const selectedBoard = useMemo(() => {
    return boards.find((board) => board._id === selectedBoardId) || null
  }, [boards, selectedBoardId])

  const topLevelBoards = useMemo(() => {
    return [...boards]
      .filter((board) => board.parentBoardId === null)
      .sort((a, b) => a.order - b.order)
  }, [boards])

  const getSubboards = (parentId: string) => {
    return [...boards]
      .filter((board) => board.parentBoardId === parentId)
      .sort((a, b) => a.order - b.order)
  }

  return (
    <BoardsContext.Provider
      value={{
        boards,
        loading,
        error,
        selectedBoardId,
        setSelectedBoardId,
        refreshBoards,
        createBoard,
        updateBoard,
        deleteBoard,
        moveBoard,
        selectedBoard,
        topLevelBoards,
        getSubboards,
      }}
    >
      {children}
    </BoardsContext.Provider>
  )
}

export function useBoards() {
  const context = useContext(BoardsContext)

  if (!context) {
    throw new Error('useBoards must be used inside BoardsProvider')
  }

  return context
}