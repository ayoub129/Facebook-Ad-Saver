import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import Board from '@/models/board'
import Ad from '@/models/Ad'
import { getSessionUser } from '@/lib/get-session-user'
import { deleteAdMediaBlobs } from '@/lib/media-cache'
import { User } from '@/models/User'
import { maxRole, normalizeEmail, resolveBoardAccess } from '@/lib/board-access'

function normalizeBoard(board: any, accessRole: string, accessSource: string) {
  return {
    _id: board._id?.toString(),
    name: board.name ?? '',
    slug: board.slug ?? '',
    source: board.source || 'app',
    parentBoardId: board.parentBoardId ? board.parentBoardId.toString() : null,
    order: typeof board.order === 'number' ? board.order : 0,
    accessRole,
    accessSource,
    isOwnedByMe: accessRole === 'owner',
    isSharedWithMe: accessRole !== 'owner',
    createdAt: board.createdAt ? new Date(board.createdAt).toISOString() : null,
    updatedAt: board.updatedAt ? new Date(board.updatedAt).toISOString() : null,
  }
}

async function collectBoardTreeIds(rootBoardId: string) {
  const allBoards = await Board.find({}).select("_id parentBoardId").lean()

  const byParent = new Map<string, string[]>()
  for (const board of allBoards) {
    const parentId = board.parentBoardId?.toString()
    const boardId = board._id?.toString()
    if (!boardId) continue
    if (!parentId) continue
    if (!byParent.has(parentId)) byParent.set(parentId, [])
    byParent.get(parentId)?.push(boardId)
  }

  const ids: string[] = []
  const queue: string[] = [rootBoardId]
  const visited = new Set<string>([rootBoardId])

  while (queue.length > 0) {
    const current = queue.shift() as string
    ids.push(current)
    const children = byParent.get(current) || []
    for (const childId of children) {
      if (visited.has(childId)) continue
      visited.add(childId)
      queue.push(childId)
    }
  }

  return ids
}

async function getEffectiveBoardAccess(
  boardId: string,
  identity: { userId: string; email: string },
  shareToken: string | null
) {
  const allBoards = await Board.find({}).select('_id userId parentBoardId isPublicShared publicShareToken publicShareRole shareEntries').lean()
  const byId = new Map<string, any>()
  for (const item of allBoards) {
    byId.set(String(item._id), item)
  }

  const visited = new Set<string>()
  let current = byId.get(boardId)
  let bestAccess: ReturnType<typeof resolveBoardAccess> = { role: 'none', source: 'none' }

  while (current) {
    const currentId = String(current._id)
    if (visited.has(currentId)) break
    visited.add(currentId)

    const access = resolveBoardAccess(
      current,
      identity,
      { shareToken }
    )

    const mergedRole = maxRole(bestAccess.role, access.role)
    bestAccess = mergedRole === bestAccess.role ? bestAccess : access

    if (!current.parentBoardId) break
    current = byId.get(String(current.parentBoardId))
  }

  return bestAccess
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const shareToken = req.nextUrl.searchParams.get('shareToken')
  const session = await getSessionUser()
  if (session.unauthorized && !shareToken) return session.unauthorized
  const userId = session.userId ? String(session.userId) : ''

  try {
    await connectToDatabase()
    const { id } = await params
    const body = await req.json()
    const user = userId ? await User.findById(userId).select('email').lean() : null
    const email = user?.email || ''

    const board = await Board.findById(id)
    if (!board) return NextResponse.json(
      { success: false, message: 'Board not found' }, { status: 404 }
    )

    const effectiveCurrentAccess = await getEffectiveBoardAccess(
      String(board._id),
      { userId, email },
      shareToken
    )
    if (!(effectiveCurrentAccess.role === 'owner' || effectiveCurrentAccess.role === 'editor')) {
      return NextResponse.json(
        { success: false, message: 'Forbidden' },
        { status: 403 }
      )
    }

    if (body.parentBoardId !== undefined && body.parentBoardId) {
      const targetParent = await Board.findById(body.parentBoardId).lean()
      if (!targetParent) {
        return NextResponse.json(
          { success: false, message: 'Parent board not found' },
          { status: 404 }
        )
      }
      const effectiveParentAccess = await getEffectiveBoardAccess(
        String(targetParent._id),
        { userId, email },
        shareToken
      )
      if (!(effectiveParentAccess.role === 'owner' || effectiveParentAccess.role === 'editor')) {
        return NextResponse.json(
          { success: false, message: 'Forbidden' },
          { status: 403 }
        )
      }
    }

    if (typeof body.name === 'string' && body.name.trim()) board.name = body.name.trim()
    if (typeof body.slug === 'string' && body.slug.trim()) board.slug = body.slug.trim()
    if (body.parentBoardId !== undefined) board.parentBoardId = body.parentBoardId || null
    if (typeof body.order === 'number') board.order = body.order

    const directAccessBefore = resolveBoardAccess(board, { userId, email }, { shareToken })
    await board.save()

    const shouldPersistDirectEditorAccess =
      effectiveCurrentAccess.role === 'editor' &&
      directAccessBefore.role === 'none' &&
      Boolean(userId) &&
      Boolean(email) &&
      String(board.userId) !== String(userId)

    if (shouldPersistDirectEditorAccess) {
      const normalizedEmail = normalizeEmail(email)
      const existingIndex = (board.shareEntries || []).findIndex(
        (entry: any) => normalizeEmail(String(entry.email || '')) === normalizedEmail
      )

      if (existingIndex >= 0) {
        board.shareEntries[existingIndex].role = 'editor'
        board.shareEntries[existingIndex].status = 'accepted'
        board.shareEntries[existingIndex].invitedUserId = userId as any
        board.shareEntries[existingIndex].acceptedAt = new Date()
      } else {
        board.shareEntries.push({
          email: normalizedEmail,
          role: 'editor',
          status: 'accepted',
          invitedUserId: userId as any,
          invitedAt: new Date(),
          acceptedAt: new Date(),
        } as any)
      }

      await board.save()
    }

    const effectiveUpdatedAccess = await getEffectiveBoardAccess(
      String(board._id),
      { userId, email },
      shareToken
    )
    return NextResponse.json({
      success: true,
      board: normalizeBoard(board, effectiveUpdatedAccess.role, effectiveUpdatedAccess.source),
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error?.message || 'Failed to update board' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const shareToken = req.nextUrl.searchParams.get('shareToken')
  const session = await getSessionUser()
  if (session.unauthorized && !shareToken) return session.unauthorized
  const userId = session.userId ? String(session.userId) : ''

  try {
    await connectToDatabase()
    const { id } = await params
    const user = userId ? await User.findById(userId).select('email').lean() : null
    const email = user?.email || ''

    const board = await Board.findById(id)
    if (!board) return NextResponse.json(
      { success: false, message: 'Board not found' }, { status: 404 }
    )

    const effectiveCurrentAccess = await getEffectiveBoardAccess(
      String(board._id),
      { userId, email },
      shareToken
    )
    if (!(effectiveCurrentAccess.role === 'owner' || effectiveCurrentAccess.role === 'editor')) {
      return NextResponse.json(
        { success: false, message: 'Forbidden' },
        { status: 403 }
      )
    }

    const boardIdsToDelete = await collectBoardTreeIds(String(id))

    // Remove ads assigned to any board being deleted (including the root board).
    const adsToDelete = await Ad.find(
      { boardIds: { $in: boardIdsToDelete } },
      { _id: 1, userId: 1, localImages: 1, localVideos: 1, localThumbnailUrl: 1 }
    ).lean()
    await Ad.deleteMany({ boardIds: { $in: boardIdsToDelete } })

    // Best-effort Blob cleanup for deleted ads.
    for (const ad of adsToDelete) {
      await deleteAdMediaBlobs({
        adId: String(ad._id),
        userId: String(ad.userId),
        blobUrls: [
          ...(Array.isArray((ad as any).localImages) ? (ad as any).localImages : []),
          ...(Array.isArray((ad as any).localVideos) ? (ad as any).localVideos : []),
          (ad as any).localThumbnailUrl || '',
        ],
      })
    }

    // Remove all boards in the deleted tree.
    await Board.deleteMany({ _id: { $in: boardIdsToDelete } })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error?.message || 'Failed to delete board' },
      { status: 500 }
    )
  }
}
