import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import { getToken } from 'next-auth/jwt'
import Ad from '@/models/Ad'
import { cacheAdMediaLocally } from '@/lib/media-cache'
import Board from '@/models/board'
import { User } from '@/models/User'
import { canEditBoard } from '@/lib/board-access'

function normalizeUrls(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const result: string[] = []

  for (const item of value) {
    if (typeof item !== 'string') continue
    const url = item.trim()
    if (!url || seen.has(url)) continue
    seen.add(url)
    result.push(url)
  }

  return result
}

function mergeUrls(...batches: unknown[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []

  for (const batch of batches) {
    for (const url of normalizeUrls(batch)) {
      if (seen.has(url)) continue
      seen.add(url)
      result.push(url)
    }
  }

  return result
}

export async function POST(req: NextRequest) {
  // Works for both cookie-based (browser) and header-based (extension) auth
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET,
  })

  if (!token?.id) {
    return NextResponse.json(
      { success: false, message: 'Unauthorized' },
      { status: 401 }
    )
  }

  const userId = String(token.id)

  try {
    await connectToDatabase()

    const body = await req.json()
    const user = await User.findById(userId).select('email').lean()
    const email = user?.email || ''

    const incomingImages = normalizeUrls(body.images)
    const incomingVideos = normalizeUrls(body.videos)
    const adLibraryId = typeof body.adLibraryId === 'string' ? body.adLibraryId.trim() : ''

    const existingAd = adLibraryId
      ? await Ad.findOne({ userId, adLibraryId })
      : null

    const incomingBoardIds = Array.isArray(body.boardIds) ? body.boardIds : []
    const permittedBoardIds: string[] = []
    if (incomingBoardIds.length > 0) {
      const boards = await Board.find({ _id: { $in: incomingBoardIds } }).lean()
      for (const board of boards) {
        if (canEditBoard(board, { userId, email })) {
          permittedBoardIds.push(String(board._id))
        }
      }
    }

    const mergedBoardIds = permittedBoardIds.length
      ? permittedBoardIds
      : existingAd?.boardIds || []

    const mergedImageCandidates = mergeUrls(
      incomingImages,
      body.thumbnailUrl ? [body.thumbnailUrl] : [],
      existingAd?.imageCandidates || [],
      existingAd?.images || []
    )
    const mergedVideoCandidates = mergeUrls(
      incomingVideos,
      existingAd?.videoCandidates || [],
      existingAd?.videos || []
    )

    const updatePayload = {
      boardIds: mergedBoardIds,
      advertiserName: body.advertiserName || existingAd?.advertiserName || '',
      adLibraryId: adLibraryId || existingAd?.adLibraryId || '',
      adCopy: body.adCopy || existingAd?.adCopy || '',
      headline: body.headline || existingAd?.headline || '',
      description: body.description || existingAd?.description || '',
      ctaText: body.ctaText || existingAd?.ctaText || '',
      ctaUrl: body.ctaUrl || existingAd?.ctaUrl || '',
      domain: body.domain || existingAd?.domain || '',
      landingPageUrl: body.landingPageUrl || existingAd?.landingPageUrl || '',
      platform: body.platform || existingAd?.platform || 'facebook_ad_library',
      status: body.status || existingAd?.status || '',
      startDate: body.startDate || existingAd?.startDate || '',
      images: incomingImages.length ? incomingImages : existingAd?.images || [],
      videos: incomingVideos.length ? incomingVideos : existingAd?.videos || [],
      thumbnailUrl: body.thumbnailUrl || existingAd?.thumbnailUrl || incomingImages[1] || incomingImages[0] || '',
      imageCandidates: mergedImageCandidates,
      videoCandidates: mergedVideoCandidates,
      refreshStatus: (incomingImages.length || incomingVideos.length) ? 'ok' : (existingAd?.refreshStatus || 'idle'),
      refreshError: '',
      lastRefreshedAt: (incomingImages.length || incomingVideos.length)
        ? new Date()
        : existingAd?.lastRefreshedAt || undefined,
      rawHtml: body.rawHtml || existingAd?.rawHtml || '',
      rawPayload: body,
    }

    const ad = existingAd
      ? await Ad.findByIdAndUpdate(existingAd._id, updatePayload, { new: true })
      : await Ad.create({
          userId: mergedBoardIds.length
            ? String((await Board.findById(mergedBoardIds[0]).select('userId').lean())?.userId || userId)
            : userId,
          ...updatePayload,
        })

    if (ad?._id) {
      const thumbnailSource = updatePayload.thumbnailUrl || mergedImageCandidates[0] || ''
      void cacheAdMediaLocally({
        adId: String(ad._id),
        userId: String(ad.userId || userId),
        imageUrls: mergedImageCandidates,
        videoUrls: mergedVideoCandidates,
        thumbnailUrl: thumbnailSource,
      })
    }

    return NextResponse.json({ success: true, ad })
  } catch (error) {
    console.error('POST /api/save-from-extension error:', error)
    return NextResponse.json(
      { success: false, message: 'Failed to save ad from extension' },
      { status: 500 }
    )
  }
}