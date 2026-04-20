import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import Board from '@/models/board'
import Ad from '@/models/Ad'
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

  const boardInvites = boards
    .map((board: any) => {
      const entry = (board.shareEntries || []).find(
        (item: any) => normalizeEmail(String(item.email || '')) === email && item.status === 'pending'
      )
      if (!entry) return null
      return {
        type: 'board' as const,
        boardId: String(board._id),
        boardName: String(board.name || 'Untitled board'),
        parentBoardId: board.parentBoardId ? String(board.parentBoardId) : null,
        role: entry.role === 'editor' ? 'editor' : 'viewer',
      }
    })
    .filter(Boolean)

  const ads = await Ad.find(
    {
      shareEntries: {
        $elemMatch: {
          email,
          status: 'pending',
        },
      },
    },
    {
      advertiserName: 1,
      shareEntries: 1,
    }
  ).lean()

  const adInvites = ads
    .map((adDoc: any) => {
      const entry = (adDoc.shareEntries || []).find(
        (item: any) => normalizeEmail(String(item.email || '')) === email && item.status === 'pending'
      )
      if (!entry) return null
      return {
        type: 'ad' as const,
        adId: String(adDoc._id),
        adName: String(adDoc.advertiserName || 'Saved ad'),
        role: 'viewer' as const,
      }
    })
    .filter(Boolean)

  return NextResponse.json({ success: true, invites: [...boardInvites, ...adInvites] })
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
  const adId = String(body?.adId || '').trim()
  const action = String(body?.action || '').trim()
  const hasBoard = Boolean(boardId)
  const hasAd = Boolean(adId)
  if ((!hasBoard && !hasAd) || (hasBoard && hasAd) || !['accept', 'decline'].includes(action)) {
    return NextResponse.json({ success: false, message: 'Invalid request' }, { status: 400 })
  }

  if (hasBoard) {
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

  const ad = await Ad.findById(adId)
  if (!ad) {
    return NextResponse.json({ success: false, message: 'Ad not found' }, { status: 404 })
  }

  const adIdx = ((ad as any).shareEntries || []).findIndex(
    (entry: any) => normalizeEmail(String(entry.email || '')) === email && entry.status === 'pending'
  )
  if (adIdx < 0) {
    return NextResponse.json({ success: false, message: 'Invite not found' }, { status: 404 })
  }

  const entries = (ad as any).shareEntries || []
  if (action === 'accept') {
    entries[adIdx].status = 'accepted'
    entries[adIdx].invitedUserId = userId as any
    entries[adIdx].acceptedAt = new Date()
  } else {
    entries.splice(adIdx, 1)
  }
  ;(ad as any).shareEntries = entries
  await ad.save()
  return NextResponse.json({ success: true })
}
