import { NextRequest, NextResponse } from "next/server"
import mongoose from "mongoose"
import { connectToDatabase } from "@/lib/mongodb"
import Ad from "@/models/Ad"
import Board from "@/models/board"
import { getSessionUser } from "@/lib/get-session-user"
import { cacheAdMediaInBlob } from "@/lib/media-cache"
import { User } from "@/models/User"
import { canEditBoard, resolveBoardAccess } from "@/lib/board-access"

export const maxDuration = 300

async function canViewBoardEffective(
  boardId: string,
  identity: { userId: string; email: string },
  shareToken: string | null
): Promise<boolean> {
  const allBoards = await Board.find({})
    .select("_id parentBoardId userId isPublicShared publicShareToken publicShareRole shareEntries")
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
    if (access.role !== "none") return true

    if (!current.parentBoardId) break
    current = byId.get(String(current.parentBoardId))
  }

  return false
}

async function collectDescendantBoardIds(rootBoardId: string): Promise<string[]> {
  const allBoards = await Board.find({}).select("_id parentBoardId").lean()

  const byParent = new Map<string, string[]>()
  for (const board of allBoards) {
    const parentId = board.parentBoardId?.toString()
    const id = board._id?.toString()
    if (!id || !parentId) continue
    if (!byParent.has(parentId)) byParent.set(parentId, [])
    byParent.get(parentId)?.push(id)
  }

  const ids: string[] = []
  const queue: string[] = [rootBoardId]
  const visited = new Set<string>([rootBoardId])

  while (queue.length > 0) {
    const current = queue.shift() as string
    ids.push(current)
    const children = byParent.get(current) || []
    for (const childId of children) {
      if (visited.has(childId)) continue
      visited.add(childId)
      queue.push(childId)
    }
  }

  return ids
}

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
    const includeDescendantsParam = searchParams.get("includeDescendants")

    let query: any = {}

    if (boardId) {
      const selectedBoard = await Board.findById(boardId).lean()
      if (!selectedBoard) return NextResponse.json(
        { success: false, message: "Board not found" }, { status: 404 }
      )

      const canView = await canViewBoardEffective(
        String(selectedBoard._id),
        { userId, email },
        tokenFromQuery
      )
      if (!canView) {
        return NextResponse.json(
          { success: false, message: "Forbidden" },
          { status: 403 }
        )
      }

      // Show only ads explicitly saved to the selected board.
      // Private view keeps existing behavior (only ads on that exact board).
      // Public/shared links default to including all descendant subboards so "share board" shares its contents.
      const includeDescendants =
        includeDescendantsParam === "1" ||
        Boolean(tokenFromQuery)

      if (includeDescendants) {
        const ids = await collectDescendantBoardIds(boardId)
        const objectIds = ids
          .filter((id) => mongoose.Types.ObjectId.isValid(id))
          .map((id) => new mongoose.Types.ObjectId(id))
        // Defensive: support legacy docs where boardIds may have been stored as strings.
        query.boardIds = { $in: [...objectIds, ...ids] }
      } else {
        if (!mongoose.Types.ObjectId.isValid(boardId)) {
          return NextResponse.json(
            { success: false, message: "Invalid boardId" },
            { status: 400 }
          )
        }
        // Defensive: support legacy docs where boardIds may have been stored as strings.
        query.boardIds = { $in: [new mongoose.Types.ObjectId(boardId), boardId] }
      }
    } else {
      // No board filter: only allow fetching your own ads (unless a boardId is specified).
      if (!userId) {
        return NextResponse.json({ success: true, ads: [] })
      }
      query.userId = userId
    }

    const ads = await Ad.find(query).sort({ createdAt: -1 }).lean()

    // Best-effort background Blob backfill for older ads that only have Facebook URLs.
    for (const ad of ads.slice(0, 20)) {
      const hasLocalMedia =
        (Array.isArray((ad as any).localImages) && (ad as any).localImages.length > 0) ||
        (Array.isArray((ad as any).localVideos) && (ad as any).localVideos.length > 0)

      if (hasLocalMedia) continue

      void cacheAdMediaInBlob({
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
      await cacheAdMediaInBlob({
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

    const storedAd = await Ad.findById(ad._id).lean()
    if (
      ((Array.isArray(body.images) && body.images.length > 0) ||
        (Array.isArray(body.videos) && body.videos.length > 0)) &&
      storedAd?.mediaCacheStatus === 'failed'
    ) {
      return NextResponse.json(
        {
          success: false,
          message: 'Ad details were saved, but its media could not be copied to Vercel Blob. You can safely retry.',
          ad: normalizeAd(storedAd),
        },
        { status: 502 }
      )
    }

    return NextResponse.json({
      success: true,
      ad: normalizeAd(storedAd || ad),
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
