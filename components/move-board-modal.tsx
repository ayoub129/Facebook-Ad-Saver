'use client'

import { useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'

type ParentBoardOption = {
  _id: string
  name: string
}

interface MoveBoardModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (parentBoardId: string) => Promise<void> | void
  boardName: string
  currentParentBoardId: string | null
  parentBoards: ParentBoardOption[]
}

export default function MoveBoardModal({
  isOpen,
  onClose,
  onSubmit,
  boardName,
  currentParentBoardId,
  parentBoards,
}: MoveBoardModalProps) {
  const availableParents = useMemo(
    () => parentBoards.filter((board) => board._id !== currentParentBoardId),
    [parentBoards, currentParentBoardId]
  )

  const [targetParentId, setTargetParentId] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setTargetParentId(availableParents[0]?._id || '')
      setIsSubmitting(false)
    }
  }, [isOpen, availableParents])

  const canSubmit = Boolean(targetParentId)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit || isSubmitting) return

    try {
      setIsSubmitting(true)
      await onSubmit(targetParentId)
      onClose()
    } catch (error) {
      console.error('Failed to move board:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-md rounded-lg bg-card p-6 shadow-lg">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-foreground">Move Subboard</h2>
          <button
            onClick={onClose}
            className="cursor-pointer rounded-md p-1 transition-colors hover:bg-muted"
            type="button"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-4 text-sm text-muted-foreground">
            Move <span className="font-medium text-foreground">{boardName}</span> to another parent board.
          </div>

          <div className="mb-6">
            <label className="mb-2 block text-sm font-medium text-foreground">
              Parent Board
            </label>

            <select
              value={targetParentId}
              onChange={(e) => setTargetParentId(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none"
            >
              {availableParents.length === 0 ? (
                <option value="">No parent boards available</option>
              ) : (
                availableParents.map((board) => (
                  <option key={board._id} value={board._id}>
                    {board.name}
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
              className="cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!canSubmit || isSubmitting}
              className="cursor-pointer"
            >
              {isSubmitting ? 'Moving...' : 'Move'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}