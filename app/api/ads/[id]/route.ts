import { NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"
import Ad from "@/models/Ad"
import { getSessionUser } from "@/lib/get-session-user"

function normalizeAd(ad: any) {
  return {
    _id: ad._id?.toString(),
    boardIds: Array.isArray(ad.boardIds) ? ad.boardIds.map((id: any) => id?.toString()) : [],
    advertiserName: ad.advertiserName || "",
    adLibraryId: ad.adLibraryId || "",
    domain: ad.domain || "",
    adCopy: ad.adCopy || "",
    headline: ad.headline || "",
    description: ad.description || "",
    ctaText: ad.ctaText || "",
    ctaUrl: ad.ctaUrl || "",
    landingPageUrl: ad.landingPageUrl || "",
    platform: ad.platform || "facebook_ad_library",
    status: ad.status || "",
    startDate: ad.startDate || "",
    images: Array.isArray(ad.images) ? ad.images : [],
    videos: Array.isArray(ad.videos) ? ad.videos : [],
    thumbnailUrl: ad.thumbnailUrl || "",
    rawHtml: ad.rawHtml || "",
    rawPayload: ad.rawPayload || {},
    createdAt: ad.createdAt ? new Date(ad.createdAt).toISOString() : null,
    updatedAt: ad.updatedAt ? new Date(ad.updatedAt).toISOString() : null,
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId, unauthorized } = await getSessionUser()
  if (unauthorized) return unauthorized

  try {
    await connectToDatabase()
    const { id } = await params
    const ad = await Ad.findOne({ _id: id, userId }).lean()

    if (!ad) return NextResponse.json(
      { success: false, message: "Ad not found" }, { status: 404 }
    )

    return NextResponse.json({ success: true, ad: normalizeAd(ad) })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error?.message || "Failed to fetch ad" },
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
    const ad = await Ad.findOneAndDelete({ _id: id, userId })

    if (!ad) return NextResponse.json(
      { success: false, message: 'Ad not found' }, { status: 404 }
    )

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error?.message || 'Failed to delete ad' },
      { status: 500 }
    )
  }
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
    const { boardId } = await req.json()

    if (!boardId) return NextResponse.json(
      { success: false, message: 'boardId required' }, { status: 400 }
    )

    const ad = await Ad.findOne({ _id: id, userId })
    if (!ad) return NextResponse.json(
      { success: false, message: 'Ad not found' }, { status: 404 }
    )

    ad.boardIds = [boardId]
    await ad.save()

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error?.message || 'Failed to move ad' },
      { status: 500 }
    )
  }
}