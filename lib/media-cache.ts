import path from 'path'
import fs from 'fs/promises'
import { createWriteStream } from 'fs'
import { pipeline } from 'stream/promises'
import { Readable } from 'stream'
import crypto from 'crypto'
import Ad from '@/models/Ad'

const MEDIA_ROOT = process.env.MEDIA_STORAGE_PATH || path.join(process.cwd(), 'storage', 'ad-media')
const DOWNLOAD_TIMEOUT_MS = 15000

type CacheInput = {
  adId: string
  userId: string
  imageUrls: string[]
  videoUrls: string[]
  thumbnailUrl?: string
}

type CleanupInput = {
  adId: string
  userId: string
}

function sanitizeSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '_')
}

function getAdMediaDir(input: CleanupInput): string {
  const safeUser = sanitizeSegment(String(input.userId || '').trim())
  const safeAd = sanitizeSegment(String(input.adId || '').trim())
  return path.join(MEDIA_ROOT, safeUser, safeAd)
}

function uniqueUrls(urls: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const value of urls) {
    const url = typeof value === 'string' ? value.trim() : ''
    if (!url || seen.has(url)) continue
    seen.add(url)
    result.push(url)
  }
  return result
}

function extensionFrom(contentType: string | null, url: string, fallback: string): string {
  const type = (contentType || '').toLowerCase()
  if (type.includes('image/jpeg')) return 'jpg'
  if (type.includes('image/png')) return 'png'
  if (type.includes('image/webp')) return 'webp'
  if (type.includes('image/gif')) return 'gif'
  if (type.includes('video/mp4')) return 'mp4'
  if (type.includes('video/webm')) return 'webm'
  if (type.includes('video/quicktime')) return 'mov'

  try {
    const parsed = new URL(url)
    const pathname = parsed.pathname.toLowerCase()
    const ext = pathname.split('.').pop()
    if (ext && /^[a-z0-9]{2,5}$/.test(ext)) return ext
  } catch {}

  return fallback
}

async function downloadUrlToFile(url: string, filePath: string): Promise<string> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal,
    })

    if (!response.ok || !response.body) {
      throw new Error(`Upstream returned ${response.status}`)
    }

    await fs.mkdir(path.dirname(filePath), { recursive: true })
    const bodyStream = Readable.fromWeb(response.body as any)
    await pipeline(bodyStream, createWriteStream(filePath))

    return response.headers.get('content-type') || ''
  } finally {
    clearTimeout(timeout)
  }
}

async function cacheMediaBatch(params: {
  adDir: string
  userId: string
  adId: string
  urls: string[]
  kind: 'image' | 'video'
}): Promise<string[]> {
  const { adDir, userId, adId, urls, kind } = params
  const results: string[] = []
  const safeUser = sanitizeSegment(userId)
  const safeAd = sanitizeSegment(adId)

  for (let index = 0; index < urls.length; index += 1) {
    const sourceUrl = urls[index]
    const hash = crypto.createHash('sha1').update(sourceUrl).digest('hex').slice(0, 12)
    const fallbackExt = kind === 'video' ? 'mp4' : 'jpg'
    const tempName = `${kind}-${index + 1}-${hash}.tmp`
    const tempPath = path.join(adDir, tempName)

    try {
      const contentType = await downloadUrlToFile(sourceUrl, tempPath)
      const ext = extensionFrom(contentType, sourceUrl, fallbackExt)
      const finalName = `${kind}-${index + 1}-${hash}.${ext}`
      const finalPath = path.join(adDir, finalName)

      await fs.rename(tempPath, finalPath)
      results.push(`/api/media/local/${safeUser}/${safeAd}/${finalName}`)
    } catch (error) {
      try {
        await fs.rm(tempPath, { force: true })
      } catch {}
      console.warn(`Media cache failed for ${kind} ${sourceUrl}:`, error)
    }
  }

  return results
}

export async function cacheAdMediaLocally(input: CacheInput): Promise<void> {
  const adId = String(input.adId || '').trim()
  const userId = String(input.userId || '').trim()
  if (!adId || !userId) return

  const imageUrls = uniqueUrls(input.imageUrls)
  const videoUrls = uniqueUrls(input.videoUrls)
  const thumb = typeof input.thumbnailUrl === 'string' ? input.thumbnailUrl.trim() : ''

  if (!imageUrls.length && !videoUrls.length && !thumb) return

  const safeUser = sanitizeSegment(userId)
  const safeAd = sanitizeSegment(adId)
  const adDir = path.join(MEDIA_ROOT, safeUser, safeAd)

  await Ad.updateOne(
    { _id: adId, userId },
    {
      $set: {
        mediaCacheStatus: 'processing',
        mediaCacheError: '',
      },
    }
  )

  try {
    const [localImages, localVideos] = await Promise.all([
      cacheMediaBatch({
        adDir,
        userId,
        adId,
        urls: imageUrls,
        kind: 'image',
      }),
      cacheMediaBatch({
        adDir,
        userId,
        adId,
        urls: videoUrls,
        kind: 'video',
      }),
    ])

    let localThumbnailUrl = ''
    const thumbnailSource = thumb || imageUrls[0] || ''
    if (thumbnailSource) {
      const thumbnailCached = await cacheMediaBatch({
        adDir,
        userId,
        adId,
        urls: [thumbnailSource],
        kind: 'image',
      })
      localThumbnailUrl = thumbnailCached[0] || localImages[0] || ''
    }

    await Ad.updateOne(
      { _id: adId, userId },
      {
        $set: {
          localImages,
          localVideos,
          localThumbnailUrl,
          mediaCacheStatus: localImages.length || localVideos.length ? 'ok' : 'failed',
          mediaCacheError: localImages.length || localVideos.length ? '' : 'No media cached',
          mediaCachedAt: new Date(),
        },
      }
    )
  } catch (error) {
    await Ad.updateOne(
      { _id: adId, userId },
      {
        $set: {
          mediaCacheStatus: 'failed',
          mediaCacheError: error instanceof Error ? error.message : 'Unknown media cache error',
        },
      }
    )
  }
}

export async function deleteAdMediaLocalFiles(input: CleanupInput): Promise<void> {
  const adId = String(input.adId || '').trim()
  const userId = String(input.userId || '').trim()
  if (!adId || !userId) return

  const adDir = getAdMediaDir({ adId, userId })
  await fs.rm(adDir, { recursive: true, force: true })
}
