import { NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"
import Ad from "@/models/Ad"
import Board from "@/models/board"
import { getSessionUser } from "@/lib/get-session-user"
import { cacheAdMediaLocally } from "@/lib/media-cache"
import { User } from "@/models/User"
import { canEditBoard, canViewBoard } from "@/lib/board-access"

function normalizeAd(ad: any) {
  const localImages = Array.isArray(ad.localImages) ? ad.localImages : []
  const localVideos = Array.isArray(ad.localVideos) ? ad.localVideos : []
  const remoteImages = Array.isArray(ad.images) ? ad.images : []
  const remoteVideos = Array.isArray(ad.videos) ? ad.videos : []

  return {
    _id: ad._id?.toString(),
    boardIds: Array.isArray(ad.boardIds) ? ad.boardIds.map((id: any) => id?.toString()) : [],
    advertiserName: ad.advertiserName || "",
    adLibraryId: ad.adLibraryId || "",
    adCopy: ad.adCopy || "",
    headline: ad.headline || "",
    description: ad.description || "",
    ctaText: ad.ctaText || "",
    ctaUrl: ad.ctaUrl || "",
    domain: ad.domain || "",
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

export async function GET(req: NextRequest) {
  const shareToken = req.nextUrl.searchParams.get("shareToken")
  const session = await getSessionUser()
  if (session.unauthorized && !shareToken) return session.unauthorized
  const userId = session.userId ? String(session.userId) : ""

  try {
    await connectToDatabase()
    const user = userId ? await User.findById(userId).select("email").lean() : null
    const email = user?.email || ""

    const { searchParams } = new URL(req.url)
    const boardId = searchParams.get("boardId")
    const tokenFromQuery = searchParams.get("shareToken") || shareToken

    let query: any = userId ? { userId } : { _id: null }

    if (boardId) {
      const selectedBoard = await Board.findById(boardId).lean()
      if (!selectedBoard) return NextResponse.json(
        { success: false, message: "Board not found" }, { status: 404 }
      )

      const canView = canViewBoard(
        selectedBoard,
        { userId, email },
        { shareToken: tokenFromQuery }
      )
      if (!canView) {
        return NextResponse.json(
          { success: false, message: "Forbidden" },
          { status: 403 }
        )
      }

      // Show only ads explicitly saved to the selected board.
      // Parent boards should not include ads saved only in child subboards.
      query.boardIds = boardId
      delete query.userId
    }

    const ads = await Ad.find(query).sort({ createdAt: -1 }).lean()

    // Best-effort background backfill for older ads that still only have remote URLs.
    for (const ad of ads.slice(0, 20)) {
      const hasLocalMedia =
        (Array.isArray((ad as any).localImages) && (ad as any).localImages.length > 0) ||
        (Array.isArray((ad as any).localVideos) && (ad as any).localVideos.length > 0)

      if (hasLocalMedia) continue

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

    return NextResponse.json({ success: true, ads: ads.map(normalizeAd) })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error?.message || "Failed to fetch ads" },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  const shareToken = req.nextUrl.searchParams.get("shareToken")
  const session = await getSessionUser()
  if (session.unauthorized && !shareToken) return session.unauthorized
  const userId = session.userId ? String(session.userId) : ""

  try {
    await connectToDatabase()
    const user = userId ? await User.findById(userId).select("email").lean() : null
    const email = user?.email || ""

    const body = await req.json()
    const targetBoardIds = Array.isArray(body.boardIds) ? body.boardIds : []

    if (!targetBoardIds.length) {
      return NextResponse.json(
        { success: false, message: "At least one board is required" },
        { status: 400 }
      )
    }

    const targetBoards = await Board.find({ _id: { $in: targetBoardIds } }).lean()
    if (targetBoards.length !== targetBoardIds.length) {
      return NextResponse.json(
        { success: false, message: "One or more boards were not found" },
        { status: 404 }
      )
    }

    const hasForbiddenBoard = targetBoards.some(
      (board) =>
        !canEditBoard(board, { userId, email }, { shareToken })
    )
    if (hasForbiddenBoard) {
      return NextResponse.json(
        { success: false, message: "Forbidden" },
        { status: 403 }
      )
    }

    const ownerUserId = String(targetBoards[0].userId)

    const ad = await Ad.create({
      boardIds: targetBoardIds,
      userId: ownerUserId,
      advertiserName: body.advertiserName || "",
      adLibraryId: body.adLibraryId || "",
      adCopy: body.adCopy || "",
      headline: body.headline || "",
      description: body.description || "",
      ctaText: body.ctaText || "",
      ctaUrl: body.ctaUrl || "",
      landingPageUrl: body.landingPageUrl || "",
      platform: body.platform || "facebook_ad_library",
      status: body.status || "",
      startDate: body.startDate || "",
      images: Array.isArray(body.images) ? body.images : [],
      videos: Array.isArray(body.videos) ? body.videos : [],
      thumbnailUrl: body.thumbnailUrl || "",
      rawHtml: body.rawHtml || "",
      rawPayload: body.rawPayload || {},
    })

    if (ad?._id) {
      void cacheAdMediaLocally({
        adId: String(ad._id),
        userId: ownerUserId,
        imageUrls: Array.isArray(body.imageCandidates)
          ? body.imageCandidates
          : (Array.isArray(body.images) ? body.images : []),
        videoUrls: Array.isArray(body.videoCandidates)
          ? body.videoCandidates
          : (Array.isArray(body.videos) ? body.videos : []),
        thumbnailUrl: body.thumbnailUrl || "",
      })
    }

    return NextResponse.json({
      success: true,
      ad: normalizeAd(ad),
    })
  } catch (error: any) {
    console.error("POST /api/ads error:", error)

    return NextResponse.json(
      {
        success: false,
        message: error?.message || "Failed to create ad",
      },
      { status: 500 }
    )
  }
}