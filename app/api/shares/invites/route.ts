import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import Board from '@/models/board'
import { User } from '@/models/User'
import { getSessionUser } from '@/lib/get-session-user'
import { normalizeEmail } from '@/lib/board-access'

export async function GET() {
  const { userId, unauthorized } = await getSessionUser()
  if (unauthorized) return unauthorized

  await connectToDatabase()
  const user = await User.findById(userId).select('email').lean()
  const email = normalizeEmail(String(user?.email || ''))
  if (!email) {
    return NextResponse.json({ success: true, invites: [] })
  }

  const boards = await Board.find(
    {
      shareEntries: {
        $elemMatch: {
          email,
          status: 'pending',
        },
      },
    },
    {
      name: 1,
      parentBoardId: 1,
      shareEntries: 1,
    }
  ).lean()

  const invites = boards
    .map((board: any) => {
      const entry = (board.shareEntries || []).find(
        (item: any) => normalizeEmail(String(item.email || '')) === email && item.status === 'pending'
      )
      if (!entry) return null
      return {
        boardId: String(board._id),
        boardName: String(board.name || 'Untitled board'),
        parentBoardId: board.parentBoardId ? String(board.parentBoardId) : null,
        role: entry.role === 'editor' ? 'editor' : 'viewer',
      }
    })
    .filter(Boolean)

  return NextResponse.json({ success: true, invites })
}

export async function POST(req: NextRequest) {
  const { userId, unauthorized } = await getSessionUser()
  if (unauthorized) return unauthorized

  await connectToDatabase()
  const user = await User.findById(userId).select('email').lean()
  const email = normalizeEmail(String(user?.email || ''))
  if (!email) {
    return NextResponse.json({ success: false, message: 'User email is required' }, { status: 400 })
  }

  const body = await req.json().catch(() => null)
  const boardId = String(body?.boardId || '').trim()
  const action = String(body?.action || '').trim()
  if (!boardId || !['accept', 'decline'].includes(action)) {
    return NextResponse.json({ success: false, message: 'Invalid request' }, { status: 400 })
  }

  const board = await Board.findById(boardId)
  if (!board) {
    return NextResponse.json({ success: false, message: 'Board not found' }, { status: 404 })
  }

  const idx = (board.shareEntries || []).findIndex(
    (entry: any) => normalizeEmail(String(entry.email || '')) === email && entry.status === 'pending'
  )
  if (idx < 0) {
    return NextResponse.json({ success: false, message: 'Invite not found' }, { status: 404 })
  }

  if (action === 'accept') {
    board.shareEntries[idx].status = 'accepted'
    board.shareEntries[idx].invitedUserId = userId as any
    board.shareEntries[idx].acceptedAt = new Date()
  } else {
    board.shareEntries.splice(idx, 1)
  }

  await board.save()
  return NextResponse.json({ success: true })
}
