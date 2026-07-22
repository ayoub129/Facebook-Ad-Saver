import crypto from 'crypto'
import { del, put } from '@vercel/blob'
import Ad from '@/models/Ad'

const DOWNLOAD_TIMEOUT_MS = Number(process.env.MEDIA_DOWNLOAD_TIMEOUT_MS) || 120_000
const MAX_MEDIA_SIZE_BYTES = Number(process.env.MAX_MEDIA_SIZE_BYTES) || 500 * 1024 * 1024
const BLOB_ROOT = 'ad-media'

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
  blobUrls?: string[]
}

function sanitizeSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '_')
}

function uniqueUrls(urls: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const value of urls) {
    const url = typeof value === 'string' ? value.trim() : ''
    if (!url || seen.has(url) || url.startsWith('/api/media/blob/')) continue
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
    const ext = new URL(url).pathname.toLowerCase().split('.').pop()
    if (ext && /^(jpe?g|png|webp|gif|mp4|webm|mov)$/.test(ext)) return ext
  } catch {}

  return fallback
}

function assertRemoteMediaUrl(value: string): URL {
  const url = new URL(value)
  if (url.protocol !== 'https:') {
    throw new Error('Only HTTPS media URLs can be copied')
  }
  return url
}

function appMediaUrl(userId: string, adId: string, filename: string): string {
  return `/api/media/blob/${sanitizeSegment(userId)}/${sanitizeSegment(adId)}/${filename}`
}

function pathnameFromAppUrl(value: string): string | null {
  const marker = '/api/media/blob/'
  const markerIndex = value.indexOf(marker)
  if (markerIndex < 0) return null

  const segments = value
    .slice(markerIndex + marker.length)
    .split('?')[0]
    .split('/')
    .filter(Boolean)

  if (segments.length !== 3 || segments.some((segment) => /[^a-zA-Z0-9_.-]/.test(segment))) {
    return null
  }

  return `${BLOB_ROOT}/${segments.join('/')}`
}

async function copyMediaToBlob(params: {
  sourceUrl: string
  userId: string
  adId: string
  index: number
  kind: 'image' | 'video'
}): Promise<string> {
  const { sourceUrl, userId, adId, index, kind } = params
  assertRemoteMediaUrl(sourceUrl)

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS)

  try {
    const response = await fetch(sourceUrl, {
      method: 'GET',
      cache: 'no-store',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        Accept: kind === 'video' ? 'video/*' : 'image/*',
      },
    })

    if (!response.ok || !response.body) {
      throw new Error(`Facebook media returned ${response.status}`)
    }

    const contentType = (response.headers.get('content-type') || '').toLowerCase()
    if (!contentType.startsWith(`${kind}/`)) {
      throw new Error(`Expected ${kind} media but received ${contentType || 'an unknown content type'}`)
    }

    const contentLength = Number(response.headers.get('content-length') || 0)
    if (contentLength > MAX_MEDIA_SIZE_BYTES) {
      throw new Error(`Media is larger than the ${MAX_MEDIA_SIZE_BYTES}-byte storage limit`)
    }

    const hash = crypto.createHash('sha1').update(sourceUrl).digest('hex').slice(0, 12)
    const extension = extensionFrom(contentType, sourceUrl, kind === 'video' ? 'mp4' : 'jpg')
    const filename = `${kind}-${index + 1}-${hash}.${extension}`
    const pathname = `${BLOB_ROOT}/${sanitizeSegment(userId)}/${sanitizeSegment(adId)}/${filename}`

    await put(pathname, response.body, {
      access: 'private',
      contentType,
      multipart: true,
      allowOverwrite: true,
      cacheControlMaxAge: 31_536_000,
    })

    return appMediaUrl(userId, adId, filename)
  } finally {
    clearTimeout(timeout)
  }
}

async function cacheMediaBatch(params: {
  userId: string
  adId: string
  urls: string[]
  kind: 'image' | 'video'
}): Promise<{ urls: string[]; sourceToUrl: Map<string, string>; errors: string[] }> {
  const results: string[] = []
  const sourceToUrl = new Map<string, string>()
  const errors: string[] = []

  for (let index = 0; index < params.urls.length; index += 1) {
    const sourceUrl = params.urls[index]
    try {
      const storedUrl = await copyMediaToBlob({ ...params, sourceUrl, index })
      results.push(storedUrl)
      sourceToUrl.set(sourceUrl, storedUrl)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown upload error'
      errors.push(`${params.kind} ${index + 1}: ${message}`)
      console.warn(`Vercel Blob copy failed for ${params.kind} ${sourceUrl}:`, error)
    }
  }

  return { urls: results, sourceToUrl, errors }
}

export async function cacheAdMediaInBlob(input: CacheInput): Promise<void> {
  const adId = String(input.adId || '').trim()
  const userId = String(input.userId || '').trim()
  if (!adId || !userId) return

  const imageUrls = uniqueUrls(input.imageUrls)
  const videoUrls = uniqueUrls(input.videoUrls)
  const thumbnailSource = typeof input.thumbnailUrl === 'string'
    ? input.thumbnailUrl.trim()
    : ''

  if (!imageUrls.length && !videoUrls.length && !thumbnailSource) return

  await Ad.updateOne(
    { _id: adId, userId },
    { $set: { mediaCacheStatus: 'processing', mediaCacheError: '' } }
  )

  try {
    const [images, videos] = await Promise.all([
      cacheMediaBatch({ userId, adId, urls: imageUrls, kind: 'image' }),
      cacheMediaBatch({ userId, adId, urls: videoUrls, kind: 'video' }),
    ])

    let localThumbnailUrl = ''
    if (thumbnailSource && images.sourceToUrl.has(thumbnailSource)) {
      localThumbnailUrl = images.sourceToUrl.get(thumbnailSource) || images.urls[0] || ''
    } else if (thumbnailSource && !thumbnailSource.startsWith('/api/media/blob/')) {
      const thumbnail = await cacheMediaBatch({
        userId,
        adId,
        urls: [thumbnailSource],
        kind: 'image',
      })
      localThumbnailUrl = thumbnail.urls[0] || images.urls[0] || ''
      images.errors.push(...thumbnail.errors)
    } else {
      localThumbnailUrl = images.urls[0] || ''
    }

    const errors = [...images.errors, ...videos.errors]
    const hasStoredMedia = images.urls.length > 0 || videos.urls.length > 0 || Boolean(localThumbnailUrl)
    const storedRequestedKinds =
      (!imageUrls.length || images.urls.length > 0) &&
      (!videoUrls.length || videos.urls.length > 0)

    await Ad.updateOne(
      { _id: adId, userId },
      {
        $set: {
          localImages: images.urls,
          localVideos: videos.urls,
          localThumbnailUrl,
          images: images.urls,
          videos: videos.urls,
          thumbnailUrl: localThumbnailUrl,
          mediaCacheStatus: hasStoredMedia && storedRequestedKinds ? 'ok' : 'failed',
          mediaCacheError: hasStoredMedia ? errors.join('; ') : errors.join('; ') || 'No media stored',
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
          mediaCacheError: error instanceof Error ? error.message : 'Unknown media storage error',
        },
      }
    )
    throw error
  }
}

export async function deleteAdMediaBlobs(input: CleanupInput): Promise<void> {
  const adId = sanitizeSegment(String(input.adId || '').trim())
  const userId = sanitizeSegment(String(input.userId || '').trim())
  if (!adId || !userId) return

  const pathnames = Array.from(new Set(input.blobUrls || []))
    .map(pathnameFromAppUrl)
    .filter((value): value is string => Boolean(value))

  if (pathnames.length > 0) {
    await del(pathnames)
  }
}
