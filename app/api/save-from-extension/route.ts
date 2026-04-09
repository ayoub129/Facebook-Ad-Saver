import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import { getToken } from 'next-auth/jwt'
import Ad from '@/models/Ad'

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

    const ad = await Ad.create({
      userId,
      boardIds: Array.isArray(body.boardIds) ? body.boardIds : [],
      advertiserName: body.advertiserName || '',
      adLibraryId: body.adLibraryId || '',
      adCopy: body.adCopy || '',
      headline: body.headline || '',
      description: body.description || '',
      ctaText: body.ctaText || '',
      ctaUrl: body.ctaUrl || '',
      domain: body.domain || '',
      landingPageUrl: body.landingPageUrl || '',
      platform: body.platform || 'facebook_ad_library',
      status: body.status || '',
      startDate: body.startDate || '',
      images: body.images || [],
      videos: body.videos || [],
      thumbnailUrl: body.thumbnailUrl || '',
      rawHtml: body.rawHtml || '',
      rawPayload: body,
    })

    return NextResponse.json({ success: true, ad })
  } catch (error) {
    console.error('POST /api/save-from-extension error:', error)
    return NextResponse.json(
      { success: false, message: 'Failed to save ad from extension' },
      { status: 500 }
    )
  }
}