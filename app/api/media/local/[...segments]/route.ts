import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs/promises'
import { getSessionUser } from '@/lib/get-session-user'
import { connectToDatabase } from '@/lib/mongodb'
import Ad from '@/models/Ad'
import Board from '@/models/board'
import { User } from '@/models/User'
import { resolveBoardAccess } from '@/lib/board-access'

export const runtime = 'nodejs'

const MEDIA_ROOT = process.env.MEDIA_STORAGE_PATH || path.join(process.cwd(), 'storage', 'ad-media')

async function canViewBoardEffective(
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

function hasUnsafeSegment(value: string): boolean {
  return !value || value.includes('..') || value.includes('/') || value.includes('\\')
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ segments: string[] }> }
) {
  const shareToken = req.nextUrl.searchParams.get('shareToken')
  const session = await getSessionUser()
  if (session.unauthorized && !shareToken) return session.unauthorized
  const userId = session.userId ? String(session.userId) : ''

  const resolved = await params
  const segments = Array.isArray(resolved?.segments) ? resolved.segments : []

  if (segments.length < 3 || segments.some(hasUnsafeSegment)) {
    return NextResponse.json(
      { success: false, message: 'Invalid media path' },
      { status: 400 }
    )
  }

  const requestedUserId = segments[0]
  const adId = segments[1]

  const fullPath = path.join(MEDIA_ROOT, ...segments)
  const normalizedRoot = path.resolve(MEDIA_ROOT)
  const normalizedTarget = path.resolve(fullPath)

  if (!normalizedTarget.startsWith(normalizedRoot)) {
    return NextResponse.json(
      { success: false, message: 'Invalid media path' },
      { status: 400 }
    )
  }

  try {
    await connectToDatabase()
    const ad = await Ad.findById(adId).lean()
    if (!ad) {
      return NextResponse.json(
        { success: false, message: 'Media not found' },
        { status: 404 }
      )
    }

    const isOwner = userId && (String(userId) === requestedUserId || String(ad.userId) === String(userId))
    if (!isOwner) {
      const user = userId ? await User.findById(userId).select('email').lean() : null
      const email = user?.email || ''
      const boards = await Board.find({ _id: { $in: ad.boardIds || [] } }).lean()
      let canView = false
      for (const board of boards) {
        const ok = await canViewBoardEffective(String(board._id), { userId: String(userId), email }, shareToken)
        if (ok) {
          canView = true
          break
        }
      }
      if (!canView) {
        return NextResponse.json(
          { success: false, message: 'Forbidden' },
          { status: 403 }
        )
      }
    }

    const stat = await fs.stat(normalizedTarget)
    if (!stat.isFile()) {
      return NextResponse.json(
        { success: false, message: 'Media not found' },
        { status: 404 }
      )
    }

    const buffer = await fs.readFile(normalizedTarget)
    const ext = path.extname(normalizedTarget).toLowerCase()
    const contentType = ext === '.mp4'
      ? 'video/mp4'
      : ext === '.webm'
        ? 'video/webm'
        : ext === '.png'
          ? 'image/png'
          : ext === '.webp'
            ? 'image/webp'
            : ext === '.gif'
              ? 'image/gif'
              : 'image/jpeg'

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, max-age=31536000, immutable',
      },
    })
  } catch {
    return NextResponse.json(
      { success: false, message: 'Media not found' },
      { status: 404 }
    )
  }
}
