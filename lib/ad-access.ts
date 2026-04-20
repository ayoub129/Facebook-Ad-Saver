import Board from '@/models/board'
import {
  canEditBoard,
  resolveShareableAccess,
  type BoardAccessRole,
  type BoardAccessSource,
} from '@/lib/board-access'
import { canViewBoardEffective } from '@/lib/board-tree-access'

type Identity = { userId: string; email: string }

/** Ad-level shares are always view-only (legacy editor roles in DB are capped here). */
export function resolveAdShareAccess(
  ad: any,
  identity: Identity,
  shareToken: string | null
): { role: BoardAccessRole; source: BoardAccessSource } {
  const r = resolveShareableAccess(ad, identity, { shareToken })
  if (r.role === 'owner') return r
  if (r.source === 'public_link' || r.source === 'private_share') {
    return { ...r, role: 'viewer' }
  }
  return r
}

export async function canViewAd(
  ad: any,
  identity: Identity,
  shareToken: string | null
): Promise<boolean> {
  if (identity.userId && String(ad.userId) === String(identity.userId)) {
    return true
  }

  if (resolveAdShareAccess(ad, identity, shareToken).role !== 'none') {
    return true
  }

  const adBoards = await Board.find({ _id: { $in: ad.boardIds || [] } }).lean()
  for (const board of adBoards) {
    const ok = await canViewBoardEffective(String(board._id), identity, shareToken)
    if (ok) return true
  }

  return false
}

export async function canEditAd(
  ad: any,
  identity: Identity,
  shareToken: string | null
): Promise<boolean> {
  if (identity.userId && String(ad.userId) === String(identity.userId)) {
    return true
  }

  // Ad-level public/private shares are view-only; editing is via board access or ownership only.

  const adBoards = await Board.find({ _id: { $in: ad.boardIds || [] } }).lean()
  for (const board of adBoards) {
    if (canEditBoard(board, identity, { shareToken })) return true
  }

  return false
}
