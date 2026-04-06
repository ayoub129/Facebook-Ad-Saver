'use client'

import { useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export type ParentBoardOption = {
  _id: string
  name: string
}

interface CreateCollectionModalProps {
  isOpen: boolean
  onClose: () => void
  onCreateCollection: (data: {
    name: string
    parentBoardId: string | null
  }) => Promise<void> | void
  parentBoards: ParentBoardOption[]
  defaultParentBoardId?: string | null
}

export default function CreateCollectionModal({
  isOpen,
  onClose,
  onCreateCollection,
  parentBoards,
  defaultParentBoardId = null,
}: CreateCollectionModalProps) {
  const [collectionName, setCollectionName] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [createAsSubboard, setCreateAsSubboard] = useState(false)
  const [parentBoardId, setParentBoardId] = useState('')

  useEffect(() => {
    if (!isOpen) {
      setCollectionName('')
      setIsSubmitting(false)
      setCreateAsSubboard(false)
      setParentBoardId('')
      return
    }

    if (defaultParentBoardId) {
      setCreateAsSubboard(true)
      setParentBoardId(defaultParentBoardId)
    } else {
      setCreateAsSubboard(false)
      setParentBoardId('')
    }
  }, [isOpen, defaultParentBoardId])

  useEffect(() => {
    if (!createAsSubboard) {
      setParentBoardId('')
      return
    }

    if (createAsSubboard && !parentBoardId && parentBoards.length > 0) {
      setParentBoardId(defaultParentBoardId || parentBoards[0]._id)
    }
  }, [createAsSubboard, parentBoardId, parentBoards, defaultParentBoardId])

  const canSubmit = useMemo(() => {
    if (!collectionName.trim()) return false
    if (createAsSubboard && !parentBoardId) return false
    return true
  }, [collectionName, createAsSubboard, parentBoardId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const trimmedName = collectionName.trim()
    if (!trimmedName || isSubmitting) return
    if (createAsSubboard && !parentBoardId) return

    try {
      setIsSubmitting(true)

      await onCreateCollection({
        name: trimmedName,
        parentBoardId: createAsSubboard ? parentBoardId : null,
      })

      setCollectionName('')
      setCreateAsSubboard(false)
      setParentBoardId('')
      onClose()
    } catch (error) {
      console.error('Failed to create collection:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-md rounded-lg bg-card p-6 shadow-lg">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-foreground">
            {createAsSubboard ? 'Create Subboard' : 'Create Collection'}
          </h2>

          <button
            onClick={onClose}
            className="cursor-pointer rounded-md p-1 transition-colors hover:bg-muted"
            aria-label="Close"
            type="button"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-5">
            <label
              htmlFor="collection-name"
              className="mb-2 block text-sm font-medium text-foreground"
            >
              Name
            </label>

            <Input
              id="collection-name"
              placeholder="Enter collection or subboard name"
              value={collectionName}
              onChange={(e) => setCollectionName(e.target.value)}
              className="w-full"
              autoFocus
            />
          </div>

          <div className="mb-5 rounded-md border border-border p-3">
            <label className="flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={createAsSubboard}
                onChange={(e) => setCreateAsSubboard(e.target.checked)}
                className="h-4 w-4"
              />
              <span className="text-sm font-medium text-foreground">
                Create as subboard
              </span>
            </label>
          </div>

          {createAsSubboard && (
            <div className="mb-6">
              <label
                htmlFor="parent-board"
                className="mb-2 block text-sm font-medium text-foreground"
              >
                Parent Board
              </label>

              <select
                id="parent-board"
                value={parentBoardId}
                onChange={(e) => setParentBoardId(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none"
              >
                {parentBoards.length === 0 ? (
                  <option value="">No parent boards available</option>
                ) : (
                  parentBoards.map((board) => (
                    <option key={board._id} value={board._id}>
                      {board.name}
                    </option>
                  ))
                )}
              </select>

              {parentBoards.length === 0 && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Create a top-level collection first, then you can add subboards under it.
                </p>
              )}
            </div>
          )}

          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="cursor-pointer"
              disabled={isSubmitting}
            >
              Cancel
            </Button>

            <Button
              type="submit"
              disabled={!canSubmit || isSubmitting}
              className="cursor-pointer"
            >
              {isSubmitting ? 'Creating...' : 'Create'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}