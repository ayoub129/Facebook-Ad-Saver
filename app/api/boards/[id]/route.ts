import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import Board from '@/models/board'
import Ad from '@/models/Ad'
import { getSessionUser } from '@/lib/get-session-user'

function normalizeBoard(board: any) {
  return {
    _id: board._id?.toString(),
    name: board.name ?? '',
    slug: board.slug ?? '',
    source: board.source || 'app',
    parentBoardId: board.parentBoardId ? board.parentBoardId.toString() : null,
    order: typeof board.order === 'number' ? board.order : 0,
    createdAt: board.createdAt ? new Date(board.createdAt).toISOString() : null,
    updatedAt: board.updatedAt ? new Date(board.updatedAt).toISOString() : null,
  }
}

async function collectBoardTreeIds(userId: string, rootBoardId: string) {
  const allBoards = await Board.find({ userId }).select("_id parentBoardId").lean()

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

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId, unauthorized } = await getSessionUser()
  if (unauthorized) return unauthorized

  try {
    await connectToDatabase()
    const { id } = await params
    const body = await req.json()

    const board = await Board.findOne({ _id: id, userId })
    if (!board) return NextResponse.json(
      { success: false, message: 'Board not found' }, { status: 404 }
    )

    if (typeof body.name === 'string' && body.name.trim()) board.name = body.name.trim()
    if (typeof body.slug === 'string' && body.slug.trim()) board.slug = body.slug.trim()
    if (body.parentBoardId !== undefined) board.parentBoardId = body.parentBoardId || null
    if (typeof body.order === 'number') board.order = body.order

    await board.save()

    return NextResponse.json({ success: true, board: normalizeBoard(board) })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error?.message || 'Failed to update board' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId, unauthorized } = await getSessionUser()
  if (unauthorized) return unauthorized

  try {
    await connectToDatabase()
    const { id } = await params

    const board = await Board.findOne({ _id: id, userId })
    if (!board) return NextResponse.json(
      { success: false, message: 'Board not found' }, { status: 404 }
    )

    const boardIdsToDelete = await collectBoardTreeIds(String(userId), String(id))

    // Remove ads assigned to any board being deleted (including the root board).
    await Ad.deleteMany({ userId, boardIds: { $in: boardIdsToDelete } })

    // Remove all boards in the deleted tree.
    await Board.deleteMany({ userId, _id: { $in: boardIdsToDelete } })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error?.message || 'Failed to delete board' },
      { status: 500 }
    )
  }
}