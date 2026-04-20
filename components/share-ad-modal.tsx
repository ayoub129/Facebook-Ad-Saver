'use client'

import { useEffect, useMemo, useState } from 'react'
import { X, Copy, Link2, UserPlus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'

type ShareEntry = {
  email: string
  status: 'pending' | 'accepted'
}

type ShareState = {
  isPublicShared: boolean
  publicUrl: string
  shareEntries: ShareEntry[]
  canManage: boolean
}

interface ShareAdModalProps {
  isOpen: boolean
  adId: string | null
  adLabel: string
  shareToken?: string | null
  onClose: () => void
}

function withShareToken(path: string, shareToken?: string | null) {
  if (!shareToken) return path
  const hasQuery = path.includes('?')
  return `${path}${hasQuery ? '&' : '?'}shareToken=${encodeURIComponent(shareToken)}`
}

function mapShareFromApi(share: any): ShareState {
  const entries = Array.isArray(share?.shareEntries) ? share.shareEntries : []
  return {
    isPublicShared: Boolean(share?.isPublicShared),
    publicUrl: String(share?.publicUrl || ''),
    shareEntries: entries.map((e: any) => ({
      email: String(e.email || ''),
      status: e.status === 'accepted' ? 'accepted' : 'pending',
    })),
    canManage: Boolean(share?.canManage),
  }
}

export default function ShareAdModal({
  isOpen,
  adId,
  adLabel,
  shareToken,
  onClose,
}: ShareAdModalProps) {
  const [loading, setLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [shareState, setShareState] = useState<ShareState | null>(null)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteError, setInviteError] = useState<string>('')
  const [isCopied, setIsCopied] = useState(false)
  const { toast } = useToast()

  const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())

  const endpoint = useMemo(() => {
    if (!adId) return ''
    return withShareToken(`/api/ads/${adId}/share`, shareToken)
  }, [adId, shareToken])

  const loadShareState = async () => {
    if (!endpoint) return
    setLoading(true)
    try {
      const res = await fetch(endpoint, { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok || !data?.success) {
        throw new Error(data?.message || 'Failed to load sharing settings')
      }
      setShareState(mapShareFromApi(data.share))
    } catch (error) {
      console.error(error)
      toast({
        title: 'Failed to load sharing settings',
        description: error instanceof Error ? error.message : 'Please try again.',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      setInviteEmail('')
      setInviteError('')
      setIsCopied(false)
      void loadShareState()
    }
  }, [isOpen, endpoint])

  const runShareAction = async (payload: Record<string, unknown>) => {
    if (!endpoint) return
    setIsSubmitting(true)
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok || !data?.success) {
        throw new Error(data?.message || 'Failed to update sharing')
      }
      setShareState((prev) => {
        const next = mapShareFromApi(data.share)
        return {
          ...next,
          canManage: prev?.canManage ?? next.canManage,
        }
      })
    } catch (error) {
      console.error(error)
      toast({
        title: 'Failed to update sharing',
        description: error instanceof Error ? error.message : 'Please try again.',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCopyPublicLink = async () => {
    if (!shareState?.publicUrl) return
    try {
      await navigator.clipboard.writeText(shareState.publicUrl)
      setIsCopied(true)
      setTimeout(() => {
        setIsCopied(false)
      }, 2000)
    } catch {
      toast({
        title: 'Copy failed',
        description: 'Could not copy the public link to clipboard.',
      })
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-2xl rounded-lg bg-card p-6 text-foreground shadow-lg">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Share ad</h2>
            <p className="text-sm text-muted-foreground">{adLabel || 'Selected ad'}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Shared people can view this ad only (read-only).
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-md p-1 transition-colors hover:bg-muted"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {loading || !shareState ? (
          <div className="py-8 text-sm text-muted-foreground">Loading sharing settings...</div>
        ) : (
          <div className="space-y-6">
            <div className="rounded-lg border border-border p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Link2 className="h-4 w-4" />
                  Public link (login required)
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant={shareState.isPublicShared ? 'destructive' : 'default'}
                  disabled={!shareState.canManage || isSubmitting}
                  onClick={() =>
                    runShareAction({
                      action: 'setPublic',
                      enabled: !shareState.isPublicShared,
                    })
                  }
                  className="cursor-pointer"
                >
                  {shareState.isPublicShared ? 'Disable' : 'Enable'}
                </Button>
              </div>

              {shareState.isPublicShared && shareState.publicUrl ? (
                <div className="flex gap-2">
                  <Input
                    value={shareState.publicUrl}
                    readOnly
                    className="bg-background text-xs text-foreground"
                  />
                  <Button
                    type="button"
                    onClick={handleCopyPublicLink}
                    className={
                      isCopied
                        ? 'cursor-pointer border-green-300 bg-green-100 text-green-800 hover:bg-green-100'
                        : 'cursor-pointer'
                    }
                    variant={isCopied ? 'default' : 'outline'}
                  >
                    <Copy className="mr-1 h-4 w-4" />
                    {isCopied ? 'Copied' : 'Copy'}
                  </Button>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Anyone with the link can open this ad after login (view only).
                </p>
              )}
            </div>

            <div className="rounded-lg border border-border p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
                <UserPlus className="h-4 w-4" />
                Private sharing by email
              </div>

              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
                <Input
                  placeholder="name@example.com"
                  value={inviteEmail}
                  onChange={(e) => {
                    setInviteEmail(e.target.value)
                    if (inviteError) setInviteError('')
                  }}
                  disabled={!shareState.canManage || isSubmitting}
                  className="w-full min-w-0 flex-1"
                />
                <Button
                  type="button"
                  disabled={!shareState.canManage || isSubmitting || !inviteEmail.trim()}
                  onClick={async () => {
                    if (!isValidEmail(inviteEmail)) {
                      setInviteError('Please enter a valid email address.')
                      return
                    }
                    setInviteError('')
                    await runShareAction({
                      action: 'invite',
                      email: inviteEmail,
                    })
                    setInviteEmail('')
                  }}
                  className="w-full shrink-0 cursor-pointer sm:w-auto sm:min-w-[88px]"
                >
                  Invite
                </Button>
              </div>
              {inviteError ? (
                <p className="mb-3 text-xs font-medium text-red-500">{inviteError}</p>
              ) : null}

              {shareState.shareEntries.length === 0 ? (
                <p className="text-xs text-muted-foreground">No private shares yet.</p>
              ) : (
                <div className="space-y-2">
                  {shareState.shareEntries.map((entry) => (
                    <div
                      key={entry.email}
                      className="flex items-center justify-between rounded border border-border px-3 py-2 text-sm"
                    >
                      <div>
                        <div className="font-medium">{entry.email}</div>
                        <div className="text-xs text-muted-foreground">{entry.status}</div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="cursor-pointer"
                        disabled={!shareState.canManage || isSubmitting}
                        onClick={() =>
                          runShareAction({
                            action: 'removeInvite',
                            email: entry.email,
                          })
                        }
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
