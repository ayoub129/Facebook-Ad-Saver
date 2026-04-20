import crypto from 'crypto'

export type BoardAccessRole = 'none' | 'viewer' | 'editor' | 'owner'
export type BoardAccessSource = 'none' | 'owner' | 'private_share' | 'public_link'

type ShareEntry = {
  email?: string
  invitedUserId?: { toString: () => string } | string | null
  role?: 'viewer' | 'editor'
  status?: 'pending' | 'accepted'
}

export type ShareableLike = {
  _id?: { toString: () => string } | string
  userId?: { toString: () => string } | string
  isPublicShared?: boolean
  publicShareToken?: string
  publicShareRole?: 'viewer' | 'editor'
  shareEntries?: ShareEntry[]
}

type BoardLike = ShareableLike

type Identity = {
  userId: string
  email?: string | null
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase()
}

export function generatePublicShareToken(): string {
  return crypto.randomBytes(24).toString('hex')
}

function rankRole(role: BoardAccessRole): number {
  if (role === 'owner') return 4
  if (role === 'editor') return 3
  if (role === 'viewer') return 2
  return 1
}

export function maxRole(a: BoardAccessRole, b: BoardAccessRole): BoardAccessRole {
  return rankRole(a) >= rankRole(b) ? a : b
}

export function resolveShareableAccess(
  resource: ShareableLike,
  identity: Identity,
  opts?: { shareToken?: string | null }
): { role: BoardAccessRole; source: BoardAccessSource } {
  const resourceOwnerId = String(resource.userId || '')
  const userId = String(identity.userId || '')
  const email = identity.email ? normalizeEmail(identity.email) : ''
  const shareToken = (opts?.shareToken || '').trim()

  if (resourceOwnerId && userId && resourceOwnerId === userId) {
    return { role: 'owner', source: 'owner' }
  }

  if (
    resource.isPublicShared &&
    resource.publicShareToken &&
    shareToken &&
    shareToken === resource.publicShareToken
  ) {
    const publicRole = resource.publicShareRole === 'viewer' ? 'viewer' : 'editor'
    return { role: publicRole, source: 'public_link' }
  }

  const entries = Array.isArray(resource.shareEntries) ? resource.shareEntries : []
  for (const entry of entries) {
    const entryEmail = entry.email ? normalizeEmail(entry.email) : ''
    const entryUserId = entry.invitedUserId ? String(entry.invitedUserId) : ''
    const statusAccepted = entry.status === 'accepted'
    if (!statusAccepted) continue

    if ((entryUserId && entryUserId === userId) || (entryEmail && entryEmail === email)) {
      return { role: entry.role || 'viewer', source: 'private_share' }
    }
  }

  return { role: 'none', source: 'none' }
}

export function resolveBoardAccess(
  board: BoardLike,
  identity: Identity,
  opts?: { shareToken?: string | null }
): { role: BoardAccessRole; source: BoardAccessSource } {
  return resolveShareableAccess(board, identity, opts)
}

export function canViewBoard(
  board: BoardLike,
  identity: Identity,
  opts?: { shareToken?: string | null }
): boolean {
  return resolveBoardAccess(board, identity, opts).role !== 'none'
}

export function canEditBoard(
  board: BoardLike,
  identity: Identity,
  opts?: { shareToken?: string | null }
): boolean {
  const role = resolveBoardAccess(board, identity, opts).role
  return role === 'owner' || role === 'editor'
}
