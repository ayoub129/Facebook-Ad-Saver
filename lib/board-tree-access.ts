import Board from '@/models/board'
import { resolveBoardAccess } from '@/lib/board-access'

/**
 * True if the user can view this board or any ancestor via ownership, private share, or matching public shareToken.
 */
export async function canViewBoardEffective(
  boardId: string,
  identity: { userId: string; email: string },
  shareToken: string | null
): Promise<boolean> {
  const allBoards = await Board.find({})
    .select('_id parentBoardId userId isPublicShared publicShareToken publicShareRole shareEntries')
    .lean()

  const byId = new Map<string, any>()
  for (const b of allBoards) byId.set(String(b._id), b)

  const visited = new Set<string>()
  let current = byId.get(String(boardId))

  while (current) {
    const currentId = String(current._id)
    if (visited.has(currentId)) break
    visited.add(currentId)

    const access = resolveBoardAccess(current, identity, { shareToken })
    if (access.role !== 'none') return true

    if (!current.parentBoardId) break
    current = byId.get(String(current.parentBoardId))
  }

  return false
}
