'use client'

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'

export type Board = {
  _id: string
  name: string
  slug: string
  parentBoardId: string | null
  order: number
  createdAt?: string
  updatedAt?: string
  source: string
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

  const refreshBoards = async () => {
    try {
      setLoading(true)
      setError(null)

      const res = await fetch('/api/boards', {
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

  const createBoard = async (payload: CreateBoardInput) => {
    const res = await fetch('/api/boards', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    const result = await res.json()

    if (!res.ok || !result?.success) {
      throw new Error(result?.message || 'Failed to create board')
    }

    await refreshBoards()
    return result.board as Board
  }

  const updateBoard = async (boardId: string, payload: UpdateBoardInput) => {
    const res = await fetch(`/api/boards/${boardId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    const result = await res.json()

    if (!res.ok || !result?.success) {
      throw new Error(result?.message || 'Failed to update board')
    }

    await refreshBoards()
    return result.board as Board
  }

  const deleteBoard = async (boardId: string) => {
    const res = await fetch(`/api/boards/${boardId}`, {
      method: 'DELETE',
    })

    const result = await res.json()

    if (!res.ok || !result?.success) {
      throw new Error(result?.message || 'Failed to delete board')
    }

    await refreshBoards()
  }

  const moveBoard = async (boardId: string, newParentBoardId: string | null) => {
    const res = await fetch(`/api/boards/${boardId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        parentBoardId: newParentBoardId,
      }),
    })

    const result = await res.json()

    if (!res.ok || !result?.success) {
      throw new Error(result?.message || 'Failed to move board')
    }

    await refreshBoards()
    return result.board as Board
  }

  useEffect(() => {
    refreshBoards()
  }, [])

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