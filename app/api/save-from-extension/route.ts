import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import Ad from '@/models/Ad'

export async function POST(req: NextRequest) {
  try {
    await connectToDatabase()

    const body = await req.json()

    const ad = await Ad.create({
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

    return NextResponse.json({
      success: true,
      ad,
    })
  } catch (error) {
    console.error('POST /api/save-from-extension error:', error)

    return NextResponse.json(
      {
        success: false,
        message: 'Failed to save ad from extension',
      },
      { status: 500 }
    )
  }
}