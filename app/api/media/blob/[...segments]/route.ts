import { get } from '@vercel/blob'
import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import { getSessionUser } from '@/lib/get-session-user'
import { canViewAd } from '@/lib/ad-access'
import Ad from '@/models/Ad'
import { User } from '@/models/User'

export const runtime = 'nodejs'

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

  const { segments = [] } = await params
  if (segments.length !== 3 || segments.some(hasUnsafeSegment)) {
    return NextResponse.json({ success: false, message: 'Invalid media path' }, { status: 400 })
  }

  const [requestedUserId, adId] = segments

  try {
    await connectToDatabase()
    const ad = await Ad.findById(adId).lean()
    if (!ad) {
      return NextResponse.json({ success: false, message: 'Media not found' }, { status: 404 })
    }

    const isOwner = userId && (
      userId === requestedUserId || String(ad.userId) === userId
    )

    if (!isOwner) {
      const user = userId ? await User.findById(userId).select('email').lean() : null
      const canView = await canViewAd(
        ad,
        { userId, email: user?.email || '' },
        shareToken
      )
      if (!canView) {
        return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 })
      }
    }

    const pathname = `ad-media/${segments.join('/')}`
    const requestHeaders: Record<string, string> = {}
    const range = req.headers.get('range')
    if (range) requestHeaders.Range = range

    const result = await get(pathname, {
      access: 'private',
      headers: requestHeaders,
    })

    if (!result || result.statusCode !== 200 || !result.stream) {
      return new NextResponse('Media not found', { status: 404 })
    }

    const contentRange = result.headers.get('content-range')
    const headers = new Headers()
    headers.set('Content-Type', result.blob.contentType)
    headers.set('Cache-Control', 'private, max-age=86400')
    headers.set('X-Content-Type-Options', 'nosniff')
    headers.set('Accept-Ranges', result.headers.get('accept-ranges') || 'bytes')
    headers.set('ETag', result.blob.etag)

    const contentLength = result.headers.get('content-length')
    if (contentLength) headers.set('Content-Length', contentLength)
    if (contentRange) headers.set('Content-Range', contentRange)

    return new NextResponse(result.stream, {
      status: contentRange ? 206 : 200,
      headers,
    })
  } catch (error) {
    console.error('Blob media delivery failed:', error)
    return NextResponse.json({ success: false, message: 'Media not found' }, { status: 404 })
  }
}
