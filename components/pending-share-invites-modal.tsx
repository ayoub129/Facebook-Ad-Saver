'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'

type Invite =
  | {
      type?: 'board'
      boardId: string
      boardName: string
      parentBoardId: string | null
      role: 'viewer' | 'editor'
    }
  | {
      type: 'ad'
      adId: string
      adName: string
      role: 'viewer' | 'editor'
    }

interface PendingShareInvitesModalProps {
  onResolved?: () => void
}

export default function PendingShareInvitesModal({ onResolved }: PendingShareInvitesModalProps) {
  const [loading, setLoading] = useState(true)
  const [invites, setInvites] = useState<Invite[]>([])
  const [isSubmittingKey, setIsSubmittingKey] = useState<string | null>(null)
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

  const inviteKey = (invite: Invite) =>
    invite.type === 'ad' ? `ad:${invite.adId}` : `board:${invite.boardId}`

  const handleAction = async (invite: Invite, action: 'accept' | 'decline') => {
    try {
      setIsSubmittingKey(inviteKey(invite))
      const body =
        invite.type === 'ad'
          ? { adId: invite.adId, action }
          : { boardId: invite.boardId, action }
      const res = await fetch('/api/shares/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok || !data?.success) {
        throw new Error(data?.message || 'Failed to update invite')
      }

      const key = inviteKey(invite)
      setInvites((prev) => prev.filter((item) => inviteKey(item as Invite) !== key))
      onResolved?.()
    } catch (error) {
      toast({
        title: 'Failed to update invite',
        description: error instanceof Error ? error.message : 'Please try again.',
      })
    } finally {
      setIsSubmittingKey(null)
    }
  }

  if (loading || invites.length === 0) return null

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-2xl rounded-lg bg-card p-6 shadow-lg">
        <h2 className="text-xl font-semibold text-foreground">Pending share invites</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          You have pending private share invites for boards or ads. Choose to accept or decline each one.
        </p>

        <div className="mt-5 space-y-3">
          {invites.map((invite) => {
            const key = inviteKey(invite as Invite)
            const title =
              (invite as Invite).type === 'ad'
                ? (invite as Extract<Invite, { type: 'ad' }>).adName
                : (invite as Extract<Invite, { boardId: string }>).boardName
            const subtitle =
              (invite as Invite).type === 'ad'
                ? 'Shared ad · View only'
                : `Shared board · Access: ${invite.role === 'editor' ? 'Editor' : 'Viewer'}`
            return (
            <div key={key} className="rounded-lg border border-border p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">{title}</p>
                  <p className="text-xs text-muted-foreground">{subtitle}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isSubmittingKey === key}
                    className="cursor-pointer"
                    onClick={() => handleAction(invite as Invite, 'decline')}
                  >
                    Decline
                  </Button>
                  <Button
                    type="button"
                    disabled={isSubmittingKey === key}
                    className="cursor-pointer"
                    onClick={() => handleAction(invite as Invite, 'accept')}
                  >
                    {isSubmittingKey === key ? 'Saving...' : 'Accept'}
                  </Button>
                </div>
              </div>
            </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
