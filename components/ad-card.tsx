'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { MoreHorizontal, Play, Pause, Volume2, VolumeX, Maximize, Trash2 } from 'lucide-react'
import { Card } from '@/components/ui/card'

export type DashboardAd = {
  _id: string
  boardIds: string[]
  advertiserName: string
  adLibraryId: string
  adCopy: string
  headline: string
  description: string
  ctaText: string
  ctaUrl: string
  landingPageUrl?: string
  platform: string
  status: string
  startDate: string
  images: string[]
  videos: string[]
  thumbnailUrl: string
  rawHtml?: string
  rawPayload?: any
  createdAt?: string | null
  updatedAt?: string | null
}

interface AdCardProps {
  ad: DashboardAd
  isPlaying?: boolean
  onVideoPlay?: () => void
  onVideoPause?: () => void
  onClick?: () => void
  onDelete?: (adId: string) => void
}

export default function AdCard({
  ad,
  isPlaying = false,
  onVideoPlay,
  onVideoPause,
  onClick,
  onDelete
}: AdCardProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isHovering, setIsHovering] = useState(false)
  const [isMuted, setIsMuted] = useState(true)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [localIsPlaying, setLocalIsPlaying] = useState(false)
  const [mediaAspectRatio, setMediaAspectRatio] = useState<number>(4 / 5)
  const [showMenu, setShowMenu] = useState(false)

  const brand = ad.advertiserName || 'Unknown advertiser'

  const logoImage = ad.images?.[0] || ''
  const mainImage = ad.images?.[1] || ''
  const videoUrl = ad.videos?.[0] || ''
  const hasVideo = Boolean(videoUrl)

  const previewImage = hasVideo
    ? ad.thumbnailUrl || mainImage || ''
    : mainImage || ''

  const brandFallback = brand.charAt(0)?.toUpperCase() || 'A'

  const daysActive = useMemo(() => {
    if (!ad.createdAt) return 0
    const created = new Date(ad.createdAt).getTime()
    if (Number.isNaN(created)) return 0

    const now = Date.now()
    const diff = now - created
    return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)))
  }, [ad.createdAt])

  const formatTime = (seconds: number) => {
    if (!seconds || Number.isNaN(seconds)) return '0:00'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const durationLabel = useMemo(() => {
    if (duration > 0) return formatTime(duration)
    return hasVideo ? 'Video' : 'Image'
  }, [duration, hasVideo])

  useEffect(() => {
    if (!previewImage || hasVideo) return

    const img = new window.Image()
    img.onload = () => {
      if (img.naturalWidth > 0 && img.naturalHeight > 0) {
        setMediaAspectRatio(img.naturalWidth / img.naturalHeight)
      }
    }
    img.src = previewImage
  }, [previewImage, hasVideo])

  const handlePlay = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!videoRef.current) return

    if (videoRef.current.paused) {
      videoRef.current.play()
      setLocalIsPlaying(true)
      onVideoPlay?.()
    } else {
      videoRef.current.pause()
      setLocalIsPlaying(false)
      onVideoPause?.()
    }
  }

  useEffect(() => {
    if (!isPlaying && localIsPlaying && videoRef.current) {
      videoRef.current.pause()
      setLocalIsPlaying(false)
    }
  }, [isPlaying, localIsPlaying])

  const handleTimeUpdate = () => {
    if (!videoRef.current) return
    setCurrentTime(videoRef.current.currentTime)
    if (videoRef.current.duration) {
      setProgress((videoRef.current.currentTime / videoRef.current.duration) * 100)
    }
  }

  const handleLoadedMetadata = () => {
    if (!videoRef.current) return

    setDuration(videoRef.current.duration)

    if (videoRef.current.videoWidth > 0 && videoRef.current.videoHeight > 0) {
      setMediaAspectRatio(videoRef.current.videoWidth / videoRef.current.videoHeight)
    }
  }

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!videoRef.current || !videoRef.current.duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    const percent = (e.clientX - rect.left) / rect.width
    videoRef.current.currentTime = percent * videoRef.current.duration
  }

  return (
    <Card
      className=" overflow-hidden hover:shadow-xl transition-all duration-300 bg-card border-border cursor-pointer group break-inside-avoid"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      <div className="p-2 sm:p-3 pb-1.5 sm:pb-2 flex items-center justify-between border-b border-border/50 bg-card/50" onClick={onClick}>
        <div className="flex items-center gap-1.5 sm:gap-2 flex-1 min-w-0">
          <div className="w-8 h-8 rounded-md bg-secondary/20 flex items-center justify-center text-xs font-semibold text-secondary flex-shrink-0 overflow-hidden">
            {logoImage ? (
              <img
                src={logoImage}
                alt={brand}
                className="w-full h-full object-cover"
                loading="lazy"
                draggable={false}
              />
            ) : (
              brandFallback
            )}
          </div>

          <div className="flex flex-col min-w-0">
            <span className="text-sm font-semibold text-foreground truncate">
              {brand}
            </span>
            <span className="text-xs text-muted-foreground">
              ●&nbsp;{daysActive}d
            </span>
          </div>
        </div>

        <div className="relative">
          <button
            className="p-1 hover:bg-muted rounded-md transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
            onClick={(e) => {
              e.stopPropagation()
              setShowMenu((prev) => !prev)
            }}
          >
            <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
          </button>

          {showMenu && (
            <div className="absolute right-0 top-full z-20 mt-2 min-w-[140px] rounded-xl border border-border bg-card shadow-lg">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setShowMenu(false)
                  onDelete?.(ad._id)
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm  text-red-500 hover:bg-muted first:rounded-t-xl last:rounded-b-xl cursor-pointer"
                >
                <Trash2 className="h-4 w-4" />
                Delete ad
              </button>
            </div>
          )}
        </div>
      </div>

      <div
        className="relative bg-muted overflow-hidden group/video"
        style={{
          aspectRatio: String(mediaAspectRatio || 4 / 5),
        }}
      >
        {hasVideo ? (
          <video
            ref={videoRef}
            src={videoUrl}
            className="w-full h-full object-contain bg-black"
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onEnded={() => {
              setLocalIsPlaying(false)
              onVideoPause?.()
            }}
            poster={previewImage}
            muted={isMuted}
            preload="metadata"
          />
        ) : previewImage ? (
          <img
            src={previewImage}
            alt={brand}
            className="w-full h-full object-contain bg-muted"
            loading="lazy"
            draggable={false}
          />
        ) : (
          <div className="w-full h-full min-h-[260px] flex items-center justify-center text-sm text-muted-foreground">
            No preview
          </div>
        )}

        {hasVideo && (isHovering || !localIsPlaying) && (
          <div className="absolute inset-0 bg-black/20 group-hover/video:bg-black/30 transition-colors flex items-center justify-center">
            <button
              onClick={handlePlay}
              className="w-14 h-14 bg-white/25 rounded-full flex items-center justify-center backdrop-blur-sm hover:bg-white/35 transition-all cursor-pointer shadow-lg"
            >
              {localIsPlaying ? (
                <Pause className="w-7 h-7 text-white fill-white" />
              ) : (
                <Play className="w-7 h-7 text-white fill-white ml-0.5" />
              )}
            </button>
          </div>
        )}

        {hasVideo && isHovering && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3 space-y-2 opacity-100 transition-opacity duration-200">
            <div
              className="h-1 bg-white/30 rounded-full cursor-pointer transition-all"
              onClick={handleProgressClick}
            >
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-white text-xs">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    if (videoRef.current) {
                      videoRef.current[localIsPlaying ? 'pause' : 'play']()
                      setLocalIsPlaying(!localIsPlaying)
                    }
                  }}
                  className="hover:bg-white/20 p-1.5 rounded transition-colors cursor-pointer"
                >
                  {localIsPlaying ? (
                    <Pause className="w-4 h-4 fill-current" />
                  ) : (
                    <Play className="w-4 h-4 fill-current ml-0.5" />
                  )}
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setIsMuted(!isMuted)
                    if (videoRef.current) {
                      videoRef.current.muted = !isMuted
                    }
                  }}
                  className="hover:bg-white/20 p-1.5 rounded transition-colors cursor-pointer"
                >
                  {isMuted ? (
                    <VolumeX className="w-4 h-4" />
                  ) : (
                    <Volume2 className="w-4 h-4" />
                  )}
                </button>

                <span className="text-xs">
                  {formatTime(currentTime)}
                </span>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation()
                  videoRef.current?.requestFullscreen()
                }}
                className="hover:bg-white/20 p-1.5 rounded transition-colors cursor-pointer"
              >
                <Maximize className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        <div className="absolute top-2 left-2 bg-black/70 text-white text-xs font-semibold px-2 py-1 rounded pointer-events-none">
          {hasVideo ? durationLabel : 'Image'}
        </div>
      </div>
    </Card>
  )
}