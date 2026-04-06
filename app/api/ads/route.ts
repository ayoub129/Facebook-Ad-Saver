import { NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"
import Ad from "@/models/Ad"
import Board from "@/models/board"

function normalizeAd(ad: any) {
  return {
    _id: ad._id?.toString(),
    boardIds: Array.isArray(ad.boardIds)
      ? ad.boardIds.map((id: any) => id?.toString())
      : [],
    advertiserName: ad.advertiserName || "",
    adLibraryId: ad.adLibraryId || "",
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

export async function GET(req: NextRequest) {
  try {
    await connectToDatabase()

    const { searchParams } = new URL(req.url)
    const boardId = searchParams.get("boardId")

    let query: any = {}

    if (boardId) {
      const selectedBoard = await Board.findById(boardId).lean()

      if (!selectedBoard) {
        return NextResponse.json(
          {
            success: false,
            message: "Board not found",
          },
          { status: 404 }
        )
      }

      if (selectedBoard.parentBoardId) {
        // selected board is a subboard
        query.boardIds = boardId
      } else {
        // selected board is a parent board → include all subboards
        const subboards = await Board.find({ parentBoardId: boardId }).lean()
        const subboardIds = subboards.map((board: any) => board._id.toString())

        query.boardIds = { $in: subboardIds }
      }
    }

    const ads = await Ad.find(query).sort({ createdAt: -1 }).lean()

    return NextResponse.json({
      success: true,
      ads: ads.map(normalizeAd),
    })
  } catch (error: any) {
    console.error("GET /api/ads error:", error)

    return NextResponse.json(
      {
        success: false,
        message: error?.message || "Failed to fetch ads",
      },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    await connectToDatabase()

    const body = await req.json()

    const ad = await Ad.create({
      boardIds: Array.isArray(body.boardIds) ? body.boardIds : [],
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