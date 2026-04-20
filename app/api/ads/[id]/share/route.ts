import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import Ad from '@/models/Ad'
import { User } from '@/models/User'
import { getSessionUser } from '@/lib/get-session-user'
import { generatePublicShareToken, normalizeEmail } from '@/lib/board-access'
import { canEditAd, canViewAd, resolveAdShareAccess } from '@/lib/ad-access'

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

  const ad = await Ad.findById(id).lean()
  if (!ad) {
    return NextResponse.json({ success: false, message: 'Ad not found' }, { status: 404 })
  }

  const canView = await canViewAd(ad, { userId: String(userId), email }, shareToken)
  if (!canView) {
    return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 })
  }

  const baseUrl = req.nextUrl.origin
  const publicToken = (ad as any).publicShareToken || ''
  const publicUrl =
    (ad as any).isPublicShared && publicToken
      ? `${baseUrl}/?shareToken=${encodeURIComponent(publicToken)}&adId=${encodeURIComponent(String((ad as any)._id))}`
      : ''

  const access = resolveAdShareAccess(ad as any, { userId: String(userId), email }, shareToken)
  const canManage = await canEditAd(ad, { userId: String(userId), email }, shareToken)

  return NextResponse.json({
    success: true,
    share: {
      isPublicShared: Boolean((ad as any).isPublicShared),
      publicShareToken: publicToken,
      publicShareRole: 'viewer',
      publicUrl,
      shareEntries: Array.isArray((ad as any).shareEntries)
        ? (ad as any).shareEntries.map(normalizeShareEntry)
        : [],
      accessRole: access.role,
      canManage,
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

  const ad = await Ad.findById(id)
  if (!ad) {
    return NextResponse.json({ success: false, message: 'Ad not found' }, { status: 404 })
  }

  const canManage = await canEditAd(ad, { userId: String(userId), email }, shareToken)
  if (!canManage) {
    return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 })
  }

  if (action === 'setPublic') {
    const enabled = Boolean(body.enabled)
    ;(ad as any).isPublicShared = enabled
    ;(ad as any).publicShareRole = 'viewer'
    if (enabled && !(ad as any).publicShareToken) {
      ;(ad as any).publicShareToken = generatePublicShareToken()
    }
    if (!enabled) {
      ;(ad as any).publicShareToken = ''
    }
    for (const e of (ad as any).shareEntries || []) {
      e.role = 'viewer'
    }
    await ad.save()
  } else if (action === 'invite') {
    const inviteEmail = normalizeEmail(String(body.email || ''))
    const role = 'viewer'
    if (!inviteEmail || !EMAIL_REGEX.test(inviteEmail)) {
      return NextResponse.json({ success: false, message: 'Please enter a valid email address' }, { status: 400 })
    }

    if (inviteEmail === normalizeEmail(email || '')) {
      return NextResponse.json(
        { success: false, message: 'You already have access to this ad' },
        { status: 400 }
      )
    }

    const entries = (ad as any).shareEntries || []
    const existingIndex = entries.findIndex(
      (entry: any) => normalizeEmail(String(entry.email || '')) === inviteEmail
    )

    if (existingIndex >= 0) {
      entries[existingIndex].role = role
      entries[existingIndex].status = 'pending'
      entries[existingIndex].invitedUserId = null
      entries[existingIndex].acceptedAt = null
    } else {
      entries.push({
        email: inviteEmail,
        role,
        status: 'pending',
        invitedUserId: null,
        invitedAt: new Date(),
        acceptedAt: null,
      })
    }
    ;(ad as any).shareEntries = entries
    await ad.save()
  } else if (action === 'removeInvite') {
    const inviteEmail = normalizeEmail(String(body.email || ''))
    ;(ad as any).shareEntries = ((ad as any).shareEntries || []).filter(
      (entry: any) => normalizeEmail(String(entry.email || '')) !== inviteEmail
    )
    await ad.save()
  } else {
    return NextResponse.json({ success: false, message: 'Invalid action' }, { status: 400 })
  }

  const refreshed = await Ad.findById(id).lean()
  const baseUrl = req.nextUrl.origin
  const pt = (refreshed as any)?.publicShareToken || ''
  const publicUrl =
    refreshed?.isPublicShared && pt
      ? `${baseUrl}/?shareToken=${encodeURIComponent(String(pt))}&adId=${encodeURIComponent(String((refreshed as any)._id))}`
      : ''

  return NextResponse.json({
    success: true,
    share: {
      isPublicShared: Boolean((refreshed as any)?.isPublicShared),
      publicShareToken: pt,
      publicShareRole: 'viewer',
      publicUrl,
      shareEntries: Array.isArray((refreshed as any)?.shareEntries)
        ? (refreshed as any).shareEntries.map(normalizeShareEntry)
        : [],
    },
  })
}
