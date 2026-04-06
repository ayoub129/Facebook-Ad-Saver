'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface DeleteBoardModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => Promise<void> | void
  boardName: string
  title?: string
  description?: string
}

export default function DeleteBoardModal({
  isOpen,
  onClose,
  onConfirm,
  boardName,
  title = 'Delete Board',
  description = 'This action cannot be undone.',
}: DeleteBoardModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!isOpen) return null

  const handleConfirm = async () => {
    if (isSubmitting) return

    try {
      setIsSubmitting(true)
      await onConfirm()
      onClose()
    } catch (error) {
      console.error('Failed to delete board:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-md rounded-lg bg-card p-6 shadow-lg">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-foreground">{title}</h2>
          <button
            onClick={onClose}
            className="cursor-pointer rounded-md p-1 transition-colors hover:bg-muted"
            type="button"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-6 space-y-3">
          <p className="text-sm text-foreground">
            Are you sure you want to delete{' '}
            <span className="font-semibold">{boardName}</span>?
          </p>
          <p className="text-sm text-muted-foreground">{description}</p>
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
            type="button"
            onClick={handleConfirm}
            disabled={isSubmitting}
            className="cursor-pointer bg-red-600 text-white hover:bg-red-700"
          >
            {isSubmitting ? 'Deleting...' : 'Delete'}
          </Button>
        </div>
      </div>
    </div>
  )
}