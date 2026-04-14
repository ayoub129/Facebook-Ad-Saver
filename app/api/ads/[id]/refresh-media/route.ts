import { NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"
import Ad from "@/models/Ad"
import { getSessionUser } from "@/lib/get-session-user"

function uniqueUrls(urls: unknown[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []

  for (const value of urls) {
    if (typeof value !== "string") continue
    const url = value.trim()
    if (!url || seen.has(url)) continue
    seen.add(url)
    result.push(url)
  }

  return result
}

function maybeMediaUrl(value: string): boolean {
  const lower = value.toLowerCase()
  return (
    lower.includes("fbcdn.net") ||
    lower.includes("video.xx.fbcdn.net") ||
    /\.(jpg|jpeg|png|webp|gif|mp4|mov|webm)(\?|$)/i.test(lower)
  )
}

function collectUrlsFromUnknown(input: unknown, limit = 250): string[] {
  const result: string[] = []
  const visited = new Set<unknown>()

  function walk(value: unknown) {
    if (result.length >= limit) return
    if (!value || visited.has(value)) return

    if (typeof value === "string") {
      const trimmed = value.trim()
      if (trimmed.startsWith("http") && maybeMediaUrl(trimmed)) {
        result.push(trimmed)
      }
      return
    }

    if (typeof value !== "object") return
    visited.add(value)

    if (Array.isArray(value)) {
      for (const item of value) walk(item)
      return
    }

    for (const item of Object.values(value as Record<string, unknown>)) {
      walk(item)
    }
  }

  walk(input)
  return uniqueUrls(result)
}

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
    imageCandidates: Array.isArray(ad.imageCandidates) ? ad.imageCandidates : [],
    videoCandidates: Array.isArray(ad.videoCandidates) ? ad.videoCandidates : [],
    refreshStatus: ad.refreshStatus || "idle",
    refreshError: ad.refreshError || "",
    lastRefreshedAt: ad.lastRefreshedAt ? new Date(ad.lastRefreshedAt).toISOString() : null,
    rawHtml: ad.rawHtml || "",
    rawPayload: ad.rawPayload || {},
    createdAt: ad.createdAt ? new Date(ad.createdAt).toISOString() : null,
    updatedAt: ad.updatedAt ? new Date(ad.updatedAt).toISOString() : null,
  }
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId, unauthorized } = await getSessionUser()
  if (unauthorized) return unauthorized

  try {
    await connectToDatabase()
    const { id } = await params
    const ad = await Ad.findOne({ _id: id, userId })

    if (!ad) {
      return NextResponse.json(
        { success: false, message: "Ad not found" },
        { status: 404 }
      )
    }

    const harvested = collectUrlsFromUnknown(ad.rawPayload)
    const imageCandidates = uniqueUrls([
      ...(Array.isArray(ad.imageCandidates) ? ad.imageCandidates : []),
      ...(Array.isArray(ad.images) ? ad.images : []),
      ad.thumbnailUrl || "",
      ...harvested.filter((url) => !/\.(mp4|mov|webm)(\?|$)/i.test(url)),
    ])
    const videoCandidates = uniqueUrls([
      ...(Array.isArray(ad.videoCandidates) ? ad.videoCandidates : []),
      ...(Array.isArray(ad.videos) ? ad.videos : []),
      ...harvested.filter((url) => /\.(mp4|mov|webm)(\?|$)/i.test(url) || url.includes("video.xx.fbcdn.net")),
    ])

    const currentMainImage = Array.isArray(ad.images) ? ad.images[1] || "" : ""
    const currentVideo = Array.isArray(ad.videos) ? ad.videos[0] || "" : ""
    const nextMainImage = imageCandidates.find((url) => url !== currentMainImage) || currentMainImage
    const nextVideo = videoCandidates.find((url) => url !== currentVideo) || currentVideo

    const logoImage = Array.isArray(ad.images) ? ad.images[0] || "" : ""
    const refreshedImages = logoImage
      ? uniqueUrls([logoImage, nextMainImage, ...imageCandidates.filter((url) => url !== logoImage)])
      : uniqueUrls([nextMainImage, ...imageCandidates])

    const changed = nextMainImage !== currentMainImage || nextVideo !== currentVideo

    ad.imageCandidates = imageCandidates
    ad.videoCandidates = videoCandidates
    ad.images = refreshedImages.slice(0, 10)
    ad.videos = uniqueUrls([nextVideo, ...videoCandidates]).slice(0, 5)
    ad.thumbnailUrl = ad.thumbnailUrl || nextMainImage || imageCandidates[0] || ""
    ad.refreshStatus = changed ? "ok" : "failed"
    ad.refreshError = changed ? "" : "No alternate media URL found. Open the ad in Facebook Ad Library and save again from extension."
    ad.lastRefreshedAt = new Date()

    await ad.save()

    const manualRefreshUrl = ad.adLibraryId
      ? `https://www.facebook.com/ads/library/?id=${encodeURIComponent(ad.adLibraryId)}`
      : "https://www.facebook.com/ads/library/"

    return NextResponse.json({
      success: true,
      ad: normalizeAd(ad),
      changed,
      manualRefreshUrl,
      message: changed
        ? "Media candidates refreshed."
        : "No alternate URL found from saved payload. Re-open the ad in Facebook Ad Library and save again.",
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error?.message || "Failed to refresh media" },
      { status: 500 }
    )
  }
}
