'use client'

import { useEffect, useMemo, useState } from 'react'
import { X, Copy, Link2, UserPlus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'

type ShareEntry = {
  email: string
  role: 'viewer' | 'editor'
  status: 'pending' | 'accepted'
}

type ShareState = {
  isPublicShared: boolean
  publicShareRole: 'viewer' | 'editor'
  publicUrl: string
  shareEntries: ShareEntry[]
  canManage: boolean
}

interface ShareBoardModalProps {
  isOpen: boolean
  boardId: string | null
  boardName: string
  shareToken?: string | null
  onClose: () => void
}

function withShareToken(path: string, shareToken?: string | null) {
  if (!shareToken) return path
  const hasQuery = path.includes('?')
  return `${path}${hasQuery ? '&' : '?'}shareToken=${encodeURIComponent(shareToken)}`
}

export default function ShareBoardModal({
  isOpen,
  boardId,
  boardName,
  shareToken,
  onClose,
}: ShareBoardModalProps) {
  const [loading, setLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [shareState, setShareState] = useState<ShareState | null>(null)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'viewer' | 'editor'>('viewer')
  const [inviteError, setInviteError] = useState<string>('')
  const [isCopied, setIsCopied] = useState(false)
  const { toast } = useToast()

  const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())

  const endpoint = useMemo(() => {
    if (!boardId) return ''
    return withShareToken(`/api/boards/${boardId}/share`, shareToken)
  }, [boardId, shareToken])

  const loadShareState = async () => {
    if (!endpoint) return
    setLoading(true)
    try {
      const res = await fetch(endpoint, { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok || !data?.success) {
        throw new Error(data?.message || 'Failed to load sharing settings')
      }
      setShareState(data.share)
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
      setInviteRole('viewer')
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
      setShareState((prev) => ({
        isPublicShared: data.share?.isPublicShared ?? prev?.isPublicShared ?? false,
        publicShareRole: data.share?.publicShareRole ?? prev?.publicShareRole ?? 'editor',
        publicUrl: data.share?.publicUrl ?? prev?.publicUrl ?? '',
        shareEntries: Array.isArray(data.share?.shareEntries) ? data.share.shareEntries : [],
        canManage: prev?.canManage ?? true,
      }))
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
      <div className="mx-4 w-full max-w-2xl rounded-lg bg-card p-6 shadow-lg">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Share board</h2>
            <p className="text-sm text-muted-foreground">{boardName || 'Selected board'}</p>
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
                      role: shareState.publicShareRole,
                    })
                  }
                  className="cursor-pointer"
                >
                  {shareState.isPublicShared ? 'Disable' : 'Enable'}
                </Button>
              </div>

              <div className="mb-3 flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Public role:</span>
                <div className="inline-flex overflow-hidden rounded-lg border border-border">
                  <button
                    type="button"
                    className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                      shareState.publicShareRole === 'viewer'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-background text-foreground hover:bg-muted'
                    }`}
                    disabled={!shareState.canManage || isSubmitting}
                    onClick={() =>
                      setShareState((prev) => (prev ? { ...prev, publicShareRole: 'viewer' } : prev))
                    }
                  >
                    Viewer
                  </button>
                  <button
                    type="button"
                    className={`border-l border-border px-3 py-1.5 text-xs font-medium transition-colors ${
                      shareState.publicShareRole === 'editor'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-background text-foreground hover:bg-muted'
                    }`}
                    disabled={!shareState.canManage || isSubmitting}
                    onClick={() =>
                      setShareState((prev) => (prev ? { ...prev, publicShareRole: 'editor' } : prev))
                    }
                  >
                    Editor
                  </button>
                </div>
              </div>

              {shareState.isPublicShared && shareState.publicUrl ? (
                <div className="flex gap-2">
                  <Input value={shareState.publicUrl} readOnly className="text-xs" />
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
                  Anyone with the link can open this board and edit it after login.
                </p>
              )}
            </div>

            <div className="rounded-lg border border-border p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
                <UserPlus className="h-4 w-4" />
                Private sharing by email
              </div>

              <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center">
                <Input
                  placeholder="name@example.com"
                  value={inviteEmail}
                  onChange={(e) => {
                    setInviteEmail(e.target.value)
                    if (inviteError) setInviteError('')
                  }}
                  disabled={!shareState.canManage || isSubmitting}
                  className="w-full min-w-0"
                />
                <div className="inline-flex h-10 shrink-0 overflow-hidden rounded-lg border border-border">
                  <button
                    type="button"
                    className={`min-w-[86px] px-3 py-1.5 text-xs font-medium transition-colors ${
                      inviteRole === 'viewer'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-background text-foreground hover:bg-muted'
                    }`}
                    disabled={!shareState.canManage || isSubmitting}
                    onClick={() => setInviteRole('viewer')}
                  >
                    Viewer
                  </button>
                  <button
                    type="button"
                    className={`min-w-[86px] border-l border-border px-3 py-1.5 text-xs font-medium transition-colors ${
                      inviteRole === 'editor'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-background text-foreground hover:bg-muted'
                    }`}
                    disabled={!shareState.canManage || isSubmitting}
                    onClick={() => setInviteRole('editor')}
                  >
                    Editor
                  </button>
                </div>
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
                      role: inviteRole,
                    })
                    setInviteEmail('')
                  }}
                  className="w-full cursor-pointer sm:w-auto sm:min-w-[88px]"
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
                        <div className="text-xs text-muted-foreground">
                          {entry.role} · {entry.status}
                        </div>
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
