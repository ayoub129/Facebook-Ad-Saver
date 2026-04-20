import { NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"
import Ad from "@/models/Ad"
import { getSessionUser } from "@/lib/get-session-user"
import { cacheAdMediaLocally, deleteAdMediaLocalFiles } from "@/lib/media-cache"
import Board from "@/models/board"
import { User } from "@/models/User"
import { canEditBoard } from "@/lib/board-access"
import { canEditAd, canViewAd } from "@/lib/ad-access"

function normalizeAd(ad: any) {
  const localImages = Array.isArray(ad.localImages) ? ad.localImages : []
  const localVideos = Array.isArray(ad.localVideos) ? ad.localVideos : []
  const remoteImages = Array.isArray(ad.images) ? ad.images : []
  const remoteVideos = Array.isArray(ad.videos) ? ad.videos : []

  return {
    _id: ad._id?.toString(),
    userId: ad.userId ? String(ad.userId) : "",
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
    images: localImages.length ? localImages : remoteImages,
    videos: localVideos.length ? localVideos : remoteVideos,
    thumbnailUrl: ad.localThumbnailUrl || ad.thumbnailUrl || "",
    localImages,
    localVideos,
    localThumbnailUrl: ad.localThumbnailUrl || "",
    imageCandidates: Array.isArray(ad.imageCandidates) ? ad.imageCandidates : [],
    videoCandidates: Array.isArray(ad.videoCandidates) ? ad.videoCandidates : [],
    mediaCacheStatus: ad.mediaCacheStatus || "idle",
    mediaCacheError: ad.mediaCacheError || "",
    mediaCachedAt: ad.mediaCachedAt ? new Date(ad.mediaCachedAt).toISOString() : null,
    refreshStatus: ad.refreshStatus || "idle",
    refreshError: ad.refreshError || "",
    lastRefreshedAt: ad.lastRefreshedAt ? new Date(ad.lastRefreshedAt).toISOString() : null,
    rawHtml: ad.rawHtml || "",
    rawPayload: ad.rawPayload || {},
    createdAt: ad.createdAt ? new Date(ad.createdAt).toISOString() : null,
    updatedAt: ad.updatedAt ? new Date(ad.updatedAt).toISOString() : null,
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const shareToken = req.nextUrl.searchParams.get("shareToken")
  const session = await getSessionUser()
  if (session.unauthorized && !shareToken) return session.unauthorized
  const userId = session.userId ? String(session.userId) : ""

  try {
    await connectToDatabase()
    const user = userId ? await User.findById(userId).select("email").lean() : null
    const email = user?.email || ""
    const { id } = await params
    const ad = await Ad.findById(id).lean()

    if (!ad) return NextResponse.json(
      { success: false, message: "Ad not found" }, { status: 404 }
    )

    const canView = await canViewAd(ad, { userId, email }, shareToken)
    if (!canView) {
      return NextResponse.json(
        { success: false, message: "Forbidden" },
        { status: 403 }
      )
    }

    const hasLocalMedia =
      (Array.isArray((ad as any).localImages) && (ad as any).localImages.length > 0) ||
      (Array.isArray((ad as any).localVideos) && (ad as any).localVideos.length > 0)

    if (!hasLocalMedia) {
      void cacheAdMediaLocally({
        adId: String((ad as any)._id),
        userId: String((ad as any).userId),
        imageUrls: [
          ...((ad as any).imageCandidates || []),
          ...((ad as any).images || []),
        ],
        videoUrls: [
          ...((ad as any).videoCandidates || []),
          ...((ad as any).videos || []),
        ],
        thumbnailUrl: String((ad as any).thumbnailUrl || ""),
      })
    }

    return NextResponse.json({ success: true, ad: normalizeAd(ad) })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error?.message || "Failed to fetch ad" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const shareToken = req.nextUrl.searchParams.get("shareToken")
  const session = await getSessionUser()
  if (session.unauthorized && !shareToken) return session.unauthorized
  const userId = session.userId ? String(session.userId) : ""

  try {
    await connectToDatabase()
    const user = userId ? await User.findById(userId).select("email").lean() : null
    const email = user?.email || ""
    const { id } = await params
    const ad = await Ad.findById(id)

    if (!ad) return NextResponse.json(
      { success: false, message: 'Ad not found' }, { status: 404 }
    )

    const canDelete = await canEditAd(ad, { userId, email }, shareToken)
    if (!canDelete) {
      return NextResponse.json(
        { success: false, message: "Forbidden" },
        { status: 403 }
      )
    }

    await Ad.deleteOne({ _id: id })

    await deleteAdMediaLocalFiles({
      adId: String(ad._id),
      userId: String(ad.userId),
    })

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
  const shareToken = req.nextUrl.searchParams.get("shareToken")
  const session = await getSessionUser()
  if (session.unauthorized && !shareToken) return session.unauthorized
  const userId = session.userId ? String(session.userId) : ""

  try {
    await connectToDatabase()
    const user = userId ? await User.findById(userId).select("email").lean() : null
    const email = user?.email || ""
    const { id } = await params
    const { boardId } = await req.json()

    if (!boardId) return NextResponse.json(
      { success: false, message: 'boardId required' }, { status: 400 }
    )

    const ad = await Ad.findById(id)
    if (!ad) return NextResponse.json(
      { success: false, message: 'Ad not found' }, { status: 404 }
    )

    const destinationBoard = await Board.findById(boardId).lean()
    if (!destinationBoard) {
      return NextResponse.json(
        { success: false, message: "Board not found" },
        { status: 404 }
      )
    }

    const canEditCurrent = await canEditAd(ad, { userId, email }, shareToken)
    const canEditDestination = canEditBoard(
      destinationBoard,
      { userId, email },
      { shareToken }
    )
    if (!canEditCurrent || !canEditDestination) {
      return NextResponse.json(
        { success: false, message: "Forbidden" },
        { status: 403 }
      )
    }

    ad.boardIds = [boardId]
    ad.userId = destinationBoard.userId as any
    await ad.save()

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error?.message || 'Failed to move ad' },
      { status: 500 }
    )
  }
}