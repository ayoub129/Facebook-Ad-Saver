'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'

type Invite = {
  boardId: string
  boardName: string
  parentBoardId: string | null
  role: 'viewer' | 'editor'
}

interface PendingShareInvitesModalProps {
  onResolved?: () => void
}

export default function PendingShareInvitesModal({ onResolved }: PendingShareInvitesModalProps) {
  const [loading, setLoading] = useState(true)
  const [invites, setInvites] = useState<Invite[]>([])
  const [isSubmittingBoardId, setIsSubmittingBoardId] = useState<string | null>(null)
  const { toast } = useToast()

  const loadInvites = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/shares/invites', { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok || !data?.success) {
        throw new Error(data?.message || 'Failed to load invites')
      }
      setInvites(Array.isArray(data.invites) ? data.invites : [])
    } catch (error) {
      toast({
        title: 'Failed to load share invites',
        description: error instanceof Error ? error.message : 'Please try again.',
      })
      setInvites([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadInvites()

    const handleFocus = () => {
      void loadInvites()
    }

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void loadInvites()
      }
    }

    const interval = setInterval(() => {
      void loadInvites()
    }, 20000)

    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [])

  const handleAction = async (invite: Invite, action: 'accept' | 'decline') => {
    try {
      setIsSubmittingBoardId(invite.boardId)
      const res = await fetch('/api/shares/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          boardId: invite.boardId,
          action,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data?.success) {
        throw new Error(data?.message || 'Failed to update invite')
      }

      setInvites((prev) => prev.filter((item) => item.boardId !== invite.boardId))
      onResolved?.()
    } catch (error) {
      toast({
        title: 'Failed to update invite',
        description: error instanceof Error ? error.message : 'Please try again.',
      })
    } finally {
      setIsSubmittingBoardId(null)
    }
  }

  if (loading || invites.length === 0) return null

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-2xl rounded-lg bg-card p-6 shadow-lg">
        <h2 className="text-xl font-semibold text-foreground">Pending board invites</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          You have pending private share invites. Choose to accept or decline each one.
        </p>

        <div className="mt-5 space-y-3">
          {invites.map((invite) => (
            <div key={invite.boardId} className="rounded-lg border border-border p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">{invite.boardName}</p>
                  <p className="text-xs text-muted-foreground">
                    Access level: {invite.role === 'editor' ? 'Editor' : 'Viewer'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isSubmittingBoardId === invite.boardId}
                    className="cursor-pointer"
                    onClick={() => handleAction(invite, 'decline')}
                  >
                    Decline
                  </Button>
                  <Button
                    type="button"
                    disabled={isSubmittingBoardId === invite.boardId}
                    className="cursor-pointer"
                    onClick={() => handleAction(invite, 'accept')}
                  >
                    {isSubmittingBoardId === invite.boardId ? 'Saving...' : 'Accept'}
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
