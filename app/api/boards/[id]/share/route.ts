import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import Board from '@/models/board'
import { User } from '@/models/User'
import { getSessionUser } from '@/lib/get-session-user'
import {
  canEditBoard,
  generatePublicShareToken,
  normalizeEmail,
  resolveBoardAccess,
} from '@/lib/board-access'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function normalizeShareEntry(entry: any) {
  return {
    email: entry.email || '',
    invitedUserId: entry.invitedUserId ? String(entry.invitedUserId) : null,
    role: entry.role || 'viewer',
    status: entry.status || 'pending',
    invitedAt: entry.invitedAt ? new Date(entry.invitedAt).toISOString() : null,
    acceptedAt: entry.acceptedAt ? new Date(entry.acceptedAt).toISOString() : null,
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId, unauthorized } = await getSessionUser()
  if (unauthorized) return unauthorized

  await connectToDatabase()
  const shareToken = req.nextUrl.searchParams.get('shareToken')
  const { id } = await params
  const user = await User.findById(userId).select('email').lean()
  const email = user?.email || ''

  const board = await Board.findById(id).lean()
  if (!board) {
    return NextResponse.json({ success: false, message: 'Board not found' }, { status: 404 })
  }

  const access = resolveBoardAccess(board, { userId: String(userId), email }, { shareToken })
  if (access.role === 'none') {
    return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 })
  }

  const baseUrl = req.nextUrl.origin
  const publicUrl = board.isPublicShared && board.publicShareToken
    ? `${baseUrl}/?shareToken=${encodeURIComponent(board.publicShareToken)}&boardId=${encodeURIComponent(String(board._id))}`
    : ''

  return NextResponse.json({
    success: true,
    share: {
      isPublicShared: Boolean(board.isPublicShared),
      publicShareToken: board.publicShareToken || '',
      publicShareRole: board.publicShareRole || 'editor',
      publicUrl,
      shareEntries: Array.isArray(board.shareEntries)
        ? board.shareEntries.map(normalizeShareEntry)
        : [],
      accessRole: access.role,
      canManage: canEditBoard(board, { userId: String(userId), email }, { shareToken }),
    },
  })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId, unauthorized } = await getSessionUser()
  if (unauthorized) return unauthorized

  await connectToDatabase()
  const shareToken = req.nextUrl.searchParams.get('shareToken')
  const { id } = await params
  const user = await User.findById(userId).select('email').lean()
  const email = user?.email || ''
  const body = await req.json()
  const action = String(body.action || '')

  const board = await Board.findById(id)
  if (!board) {
    return NextResponse.json({ success: false, message: 'Board not found' }, { status: 404 })
  }

  const canManage = canEditBoard(board, { userId: String(userId), email }, { shareToken })
  if (!canManage) {
    return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 })
  }

  if (action === 'setPublic') {
    const enabled = Boolean(body.enabled)
    const role = body.role === 'viewer' ? 'viewer' : 'editor'
    board.isPublicShared = enabled
    board.publicShareRole = role
    if (enabled && !board.publicShareToken) {
      board.publicShareToken = generatePublicShareToken()
    }
    if (!enabled) {
      board.publicShareToken = ''
    }
    await board.save()
  } else if (action === 'invite') {
    const inviteEmail = normalizeEmail(String(body.email || ''))
    const role = body.role === 'editor' ? 'editor' : 'viewer'
    if (!inviteEmail || !EMAIL_REGEX.test(inviteEmail)) {
      return NextResponse.json({ success: false, message: 'Please enter a valid email address' }, { status: 400 })
    }

    if (inviteEmail === normalizeEmail(email || '')) {
      return NextResponse.json(
        { success: false, message: 'You already have access as owner/editor' },
        { status: 400 }
      )
    }

    const existingIndex = (board.shareEntries || []).findIndex(
      (entry: any) => normalizeEmail(String(entry.email || '')) === inviteEmail
    )

    if (existingIndex >= 0) {
      board.shareEntries[existingIndex].role = role
      board.shareEntries[existingIndex].status = 'pending'
      board.shareEntries[existingIndex].invitedUserId = null
      board.shareEntries[existingIndex].acceptedAt = null
    } else {
      board.shareEntries.push({
        email: inviteEmail,
        role,
        status: 'pending',
        invitedUserId: null,
        invitedAt: new Date(),
        acceptedAt: null,
      })
    }
    await board.save()
  } else if (action === 'removeInvite') {
    const inviteEmail = normalizeEmail(String(body.email || ''))
    board.shareEntries = (board.shareEntries || []).filter(
      (entry: any) => normalizeEmail(String(entry.email || '')) !== inviteEmail
    )
    await board.save()
  } else {
    return NextResponse.json({ success: false, message: 'Invalid action' }, { status: 400 })
  }

  const refreshed = await Board.findById(id).lean()
  const baseUrl = req.nextUrl.origin
  const publicUrl = refreshed?.isPublicShared && refreshed?.publicShareToken
    ? `${baseUrl}/?shareToken=${encodeURIComponent(String(refreshed.publicShareToken))}&boardId=${encodeURIComponent(String(refreshed._id))}`
    : ''

  return NextResponse.json({
    success: true,
    share: {
      isPublicShared: Boolean(refreshed?.isPublicShared),
      publicShareToken: refreshed?.publicShareToken || '',
      publicShareRole: refreshed?.publicShareRole || 'editor',
      publicUrl,
      shareEntries: Array.isArray(refreshed?.shareEntries)
        ? refreshed?.shareEntries.map(normalizeShareEntry)
        : [],
    },
  })
}
