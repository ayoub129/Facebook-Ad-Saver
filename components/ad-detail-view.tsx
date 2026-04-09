'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Image as ImageIcon,
  Eye,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Pencil,
  ExternalLink,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useBoards } from '@/components/ui/boards-provider'
import type { DashboardAd } from './ad-card'
import { transcribeVideoUrlInBrowser } from '@/lib/browser-transcription'

interface AdDetailViewProps {
  adId: string
  onBack: () => void
}

type SubboardOption = {
  id: string
  name: string
  fullName: string
}

export default function AdDetailView({ adId, onBack }: AdDetailViewProps) {
  const { boards } = useBoards()

  const [ad, setAd] = useState<DashboardAd | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [selectedBoard, setSelectedBoard] = useState('')
  const [showBoardDropdown, setShowBoardDropdown] = useState(false)

  const [isMuted, setIsMuted] = useState(true)
  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [videoError, setVideoError] = useState(false)
  const [isHoveringMedia, setIsHoveringMedia] = useState(false)
  const [mediaAspectRatio, setMediaAspectRatio] = useState<number>(4 / 5)

  const [activeImageIndex, setActiveImageIndex] = useState(0)

  const [isCopyingScript, setIsCopyingScript] = useState(false)
  const [isDownloadingMedia, setIsDownloadingMedia] = useState(false)
  const [isSavingBoard, setIsSavingBoard] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onBack()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onBack])

  useEffect(() => {
    const fetchAd = async () => {
      try {
        setLoading(true)
        setError(null)

        const res = await fetch(`/api/ads/${adId}`, {
          method: 'GET',
          cache: 'no-store',
        })

        const data = await res.json()

        if (!res.ok || !data?.success) {
          throw new Error(data?.message || 'Failed to fetch ad')
        }

        setAd(data.ad || null)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to fetch ad'
        setError(message)
        setAd(null)
      } finally {
        setLoading(false)
      }
    }

    fetchAd()
  }, [adId])

  const subboardsOnly = useMemo<SubboardOption[]>(() => {
    const boardMap = new Map(boards.map((board) => [board._id, board]))
  
    const buildFullName = (boardId: string) => {
      const parts: string[] = []
      let current = boardMap.get(boardId)
  
      while (current) {
        parts.unshift(current.name)
        current = current.parentBoardId ? boardMap.get(current.parentBoardId) : undefined
      }
  
      return parts.join(' / ')
    }
  
    return boards
      .filter((board) => Boolean(board.parentBoardId))
      .map((board) => ({
        id: board._id,
        name: board.name,
        fullName: buildFullName(board._id),
      }))
  }, [boards])
    
  const brand = ad?.advertiserName || 'Unknown advertiser'
  const logoImage = ad?.images?.[0] || ''
  const videoUrl = ad?.videos?.[0] || ''
  const hasVideo = Boolean(videoUrl)

  const galleryImages = useMemo(() => {
    if (!ad?.images?.length) return []
    return ad.images.slice(1).filter(Boolean)
  }, [ad?.images])

  const hasImageSlider = !hasVideo && galleryImages.length > 1
  const activeGalleryImage = galleryImages[activeImageIndex] || galleryImages[0] || ''
  const previewImage = hasVideo
    ? ad?.thumbnailUrl || galleryImages[0] || ''
    : activeGalleryImage || galleryImages[0] || ''

  useEffect(() => {
    setActiveImageIndex(0)
  }, [adId, galleryImages.length])

  useEffect(() => {
    if (hasVideo || !previewImage) return

    const img = new window.Image()
    img.onload = () => {
      if (img.naturalWidth > 0 && img.naturalHeight > 0) {
        setMediaAspectRatio(img.naturalWidth / img.naturalHeight)
      }
    }
    img.src = previewImage
  }, [previewImage, hasVideo])

  const linkedBoardNames = useMemo(() => {
    if (!ad?.boardIds?.length) return []

    const boardMap = new Map(boards.map((board) => [board._id, board]))

    return ad.boardIds.map((id) => {
      const board = boardMap.get(id)
      if (!board) return id

      const parent = board.parentBoardId ? boardMap.get(board.parentBoardId) : null
      return parent ? `${parent.name} / ${board.name}` : board.name
    })
  }, [ad?.boardIds, boards])

  const domainText = useMemo(() => {
    if (!ad?.ctaUrl) return ''

    try {
      const url = new URL(ad.ctaUrl)
      return url.hostname.replace(/^www\./, '').toUpperCase()
    } catch {
      return ''
    }
  }, [ad?.ctaUrl])

  const formatTime = (seconds: number) => {
    if (!seconds || Number.isNaN(seconds)) return '0:00'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const stopPlayback = () => {
    if (!videoRef.current) return
    videoRef.current.pause()
    videoRef.current.currentTime = 0
    setIsPlaying(false)
    setCurrentTime(0)
    setProgress(0)
  }

  const handlePlayToggle = async (e?: React.MouseEvent) => {
    e?.stopPropagation()
    if (!videoRef.current || videoError) return

    try {
      if (videoRef.current.paused) {
        await videoRef.current.play()
        setIsPlaying(true)
      } else {
        videoRef.current.pause()
        setIsPlaying(false)
      }
    } catch (err) {
      console.error('Video play failed:', err)
      setVideoError(true)
      setIsPlaying(false)
    }
  }

  const handleLoadedMetadata = () => {
    if (!videoRef.current) return

    setDuration(videoRef.current.duration || 0)

    if (videoRef.current.videoWidth > 0 && videoRef.current.videoHeight > 0) {
      setMediaAspectRatio(videoRef.current.videoWidth / videoRef.current.videoHeight)
    }
  }

  const handleTimeUpdate = () => {
    if (!videoRef.current) return

    setCurrentTime(videoRef.current.currentTime || 0)

    if (videoRef.current.duration) {
      setProgress((videoRef.current.currentTime / videoRef.current.duration) * 100)
    }
  }

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation()
    if (!videoRef.current || !videoRef.current.duration) return

    const rect = e.currentTarget.getBoundingClientRect()
    const percent = (e.clientX - rect.left) / rect.width
    videoRef.current.currentTime = percent * videoRef.current.duration
  }

  const handleMuteToggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    const nextMuted = !isMuted
    setIsMuted(nextMuted)

    if (videoRef.current) {
      videoRef.current.muted = nextMuted
    }
  }

  const handleFullscreen = (e: React.MouseEvent) => {
    e.stopPropagation()
    videoRef.current?.requestFullscreen()
  }

  const goToPrevImage = () => {
    if (!galleryImages.length) return
    setActiveImageIndex((prev) => (prev === 0 ? galleryImages.length - 1 : prev - 1))
  }

  const goToNextImage = () => {
    if (!galleryImages.length) return
    setActiveImageIndex((prev) => (prev === galleryImages.length - 1 ? 0 : prev + 1))
  }

  const triggerBlobDownload = (blob: Blob, filename: string) => {
    const blobUrl = window.URL.createObjectURL(blob)

    const a = document.createElement('a')
    a.href = blobUrl
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()

    window.URL.revokeObjectURL(blobUrl)
  }

  const triggerUrlDownload = (url: string, filename?: string) => {
    const a = document.createElement('a')
    a.href = url
    if (filename) a.download = filename
    a.target = '_blank'
    a.rel = 'noreferrer'
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  const getSafeBrandSlug = () =>
    brand.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-_]/g, '').toLowerCase()

  const getImageExtension = (url: string) => {
    try {
      const cleanUrl = url.split('?')[0].toLowerCase()
      if (cleanUrl.endsWith('.png')) return 'png'
      if (cleanUrl.endsWith('.webp')) return 'webp'
      if (cleanUrl.endsWith('.jpeg')) return 'jpeg'
      if (cleanUrl.endsWith('.jpg')) return 'jpg'
      return 'jpg'
    } catch {
      return 'jpg'
    }
  }

  const downloadSingleImage = async (imageUrl: string, filename: string) => {
    const res = await fetch(imageUrl)
    if (!res.ok) throw new Error('Failed to fetch image')
    const blob = await res.blob()
    triggerBlobDownload(blob, filename)
  }

  const handleCopyScript = async () => {
    if (!ad || !hasVideo || !videoUrl) return

    try {
      setIsCopyingScript(true)

      const scriptText =
        (await transcribeVideoUrlInBrowser(videoUrl)) ||
        ad.adCopy?.trim() ||
        ad.headline?.trim() ||
        ad.description?.trim() ||
        ''

      if (!scriptText) {
        alert('No script available.')
        return
      }

      await navigator.clipboard.writeText(scriptText)
      alert('Script copied successfully.')
    } catch (err) {
      console.error('Copy script failed:', err)
      alert(err instanceof Error ? err.message : 'Failed to copy script')
    } finally {
      setIsCopyingScript(false)
    }
  }

  const handleDownloadMedia = async () => {
    if (!ad) return

    try {
      setIsDownloadingMedia(true)

      const brandSlug = getSafeBrandSlug()

      if (hasVideo && videoUrl) {
        const res = await fetch(`/api/ads/${adId}/download`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            videoUrl,
            type: 'video',
          }),
        })

        const contentType = res.headers.get('content-type') || ''

        if (!res.ok) {
          let message = 'Failed to download video'
          try {
            const data = await res.json()
            message = data?.message || message
          } catch {}
          throw new Error(message)
        }

        if (contentType.includes('application/json')) {
          const data = await res.json()

          if (!data?.success) {
            throw new Error(data?.message || 'Failed to download video')
          }

          if (data.url) {
            triggerUrlDownload(data.url, `${brandSlug}-video.mp4`)
            return
          }

          throw new Error('No downloadable video URL returned')
        }

        const blob = await res.blob()
        triggerBlobDownload(blob, `${brandSlug}-video.mp4`)
        return
      }

      if (!galleryImages.length) {
        alert('No media available to download.')
        return
      }

      if (galleryImages.length === 1) {
        const imageUrl = galleryImages[0]
        const ext = getImageExtension(imageUrl)
        await downloadSingleImage(imageUrl, `${brandSlug}-image-1.${ext}`)
        return
      }

      for (let i = 0; i < galleryImages.length; i++) {
        const imageUrl = galleryImages[i]
        const ext = getImageExtension(imageUrl)
        await downloadSingleImage(imageUrl, `${brandSlug}-image-${i + 1}.${ext}`)

        if (i < galleryImages.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 250))
        }
      }
    } catch (err) {
      console.error('Media download failed:', err)
      alert(err instanceof Error ? err.message : 'Failed to download media')
    } finally {
      setIsDownloadingMedia(false)
    }
  }

  const handleDownloadThumbnail = async () => {
    if (!previewImage) {
      alert('No thumbnail available.')
      return
    }

    try {
      const res = await fetch(previewImage)
      if (!res.ok) throw new Error('Failed to fetch thumbnail')
      const blob = await res.blob()

      triggerBlobDownload(
        blob,
        `${brand.replace(/\s+/g, '-').toLowerCase()}-thumbnail.jpg`
      )
    } catch (err) {
      console.error('Thumbnail download failed:', err)
      triggerUrlDownload(previewImage)
    }
  }

  const handleSaveToBoard = async (boardId: string, boardName: string) => {
    if (!ad) return
  
    try {
      setIsSavingBoard(true)
  
      const res = await fetch(`/api/ads/${ad._id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          boardId,
        }),
      })
  
      const data = await res.json()
  
      if (!res.ok || !data?.success) {
        throw new Error(data?.message || 'Failed to save ad to board')
      }
  
      // Replace boardIds entirely instead of merging
      setAd((prev) => (prev ? { ...prev, boardIds: [boardId] } : prev))
      setSelectedBoard(boardName)
      setShowBoardDropdown(false)
    } catch (err) {
      console.error('Save to board failed:', err)
      alert(err instanceof Error ? err.message : 'Failed to save ad to board')
    } finally {
      setIsSavingBoard(false)
    }
  }
  
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-muted-foreground">
        Loading ad...
      </div>
    )
  }

  if (error || !ad) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-background">
        <p className="text-sm text-muted-foreground">{error || 'Ad not found'}</p>
        <Button onClick={onBack} variant="outline" className="cursor-pointer">
          Go back
        </Button>
      </div>
    )
  }

  return (
      <div className="flex h-screen flex-col bg-[#1d143b] text-white">
      <div className="border-b border-white/10 bg-gradient-to-r from-[#4f2bd6] to-[#6c3cf0] px-6 py-4 text-white">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <button
              onClick={onBack}
              className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 transition-colors hover:bg-primary/90"
              type="button"
            >
              <ChevronLeft className="h-5 w-5" />
              <span className="text-sm font-semibold">Back</span>
            </button>

            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-primary-foreground/20">
              {logoImage ? (
                <img
                  src={logoImage}
                  alt={brand}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-lg font-bold">
                  {brand.charAt(0).toUpperCase()}
                </span>
              )}
            </div>

            <span className="truncate text-sm font-semibold">{brand}</span>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-[26%] overflow-y-auto border-r border-border bg-[#1d143b] p-6 text-white">
          <div className="mx-auto max-w-md">
            <div className="mb-6 flex items-center gap-3 text-violet-200">
              <Pencil className="h-5 w-5" />
              <h2 className="text-xl font-bold uppercase tracking-[0.18em]">
                Ad Copy
              </h2>
            </div>

            <div className="space-y-6">
              <div>
                <p className="whitespace-pre-wrap text-[15px] leading-6 text-white/95">
                  {ad.adCopy || 'No ad copy available'}
                </p>
              </div>

              <div className="border-t border-white/15" />

              {(ad.domain || ad.headline || ad.description) && (
                <div className="space-y-3">
                  {ad.domain && (
                    <p className="text-[14px] font-extrabold uppercase tracking-wide text-white/75">
                      {ad.domain}
                    </p>
                  )}

                  {ad.headline && (
                    <p className="text-lg font-bold leading-8 text-white">
                      {ad.headline}
                    </p>
                  )}

                  {ad.description && (
                    <p className="text-[14px] leading-6 text-white/75">
                      {ad.description}
                    </p>
                  )}
                </div>
              )}

              <div className="border-t border-white/15" />

              <div className="flex flex-wrap items-center gap-4 pt-1">
                <div className="flex items-center gap-2 text-violet-200">
                  <ExternalLink className="h-4 w-4" />
                  <span className="text-sm font-semibold uppercase tracking-[0.16em]">
                    CTA
                  </span>
                </div>

                <a href={ad.ctaUrl} className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-[#1d143b] shadow-sm">
                  {ad.ctaText || 'N/A'}
                </a>

                <span className="text-base font-medium text-white/90">
                  {ad.ctaText || 'N/A'}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-1 justify-center overflow-y-auto border-r border-white/10 bg-[#120c2b] px-6 py-6">
          <div className="relative flex w-full max-w-md items-start justify-center">
            <div
              className="group relative overflow-hidden rounded-2xl border border-white/10 bg-black shadow-2xl"
              onMouseEnter={() => setIsHoveringMedia(true)}
              onMouseLeave={() => setIsHoveringMedia(false)}
            >
              {hasVideo && !videoError ? (
                <div className="relative w-full max-h-[calc(100vh-140px)] overflow-hidden rounded-2xl bg-black">
                  <video
                    ref={videoRef}
                    src={videoUrl}
                    poster={previewImage || undefined}
                    className="max-h-[calc(100vh-140px)] w-full bg-black object-contain"
                    muted={isMuted}
                    onLoadedMetadata={handleLoadedMetadata}
                    onTimeUpdate={handleTimeUpdate}
                    onEnded={() => setIsPlaying(false)}
                    onError={() => {
                      console.error('Video failed to load:', videoUrl)
                      setVideoError(true)
                      setIsPlaying(false)
                    }}
                    preload="metadata"
                    playsInline
                  />

                  {(isHoveringMedia || !isPlaying) && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 transition-colors group-hover:bg-black/30">
                      <button
                        onClick={handlePlayToggle}
                        className="flex h-20 w-20 cursor-pointer items-center justify-center rounded-full bg-white/20 backdrop-blur-sm transition-all hover:bg-white/30"
                        type="button"
                      >
                        {isPlaying ? (
                          <Pause className="h-10 w-10 fill-white text-white" />
                        ) : (
                          <Play className="ml-1 h-10 w-10 fill-white text-white" />
                        )}
                      </button>
                    </div>
                  )}

                  {isHoveringMedia && (
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent p-4">
                      <div
                        className="mb-3 h-1 cursor-pointer rounded-full bg-white/30"
                        onClick={handleProgressClick}
                      >
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${progress}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-xs text-white">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={handlePlayToggle}
                            className="cursor-pointer rounded p-1.5 transition-colors hover:bg-white/20"
                            type="button"
                          >
                            {isPlaying ? (
                              <Pause className="h-4 w-4 fill-current" />
                            ) : (
                              <Play className="ml-0.5 h-4 w-4 fill-current" />
                            )}
                          </button>

                          <button
                            onClick={handleMuteToggle}
                            className="cursor-pointer rounded p-1.5 transition-colors hover:bg-white/20"
                            type="button"
                          >
                            {isMuted ? (
                              <VolumeX className="h-4 w-4" />
                            ) : (
                              <Volume2 className="h-4 w-4" />
                            )}
                          </button>

                          <span>{formatTime(currentTime)}</span>
                          <span>/</span>
                          <span>{formatTime(duration)}</span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              stopPlayback()
                            }}
                            className="cursor-pointer rounded px-2 py-1 transition-colors hover:bg-white/20"
                            type="button"
                          >
                            Stop
                          </button>

                          <button
                            onClick={handleFullscreen}
                            className="cursor-pointer rounded p-1.5 transition-colors hover:bg-white/20"
                            type="button"
                          >
                            <Maximize className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : previewImage ? (
                <div
                  className="relative overflow-hidden bg-black"
                  style={{ aspectRatio: String(mediaAspectRatio || 4 / 5) }}
                >
                  <img
                    src={previewImage}
                    alt={brand}
                    className="h-full w-full bg-black object-contain"
                  />

                  {hasImageSlider && (
                    <>
                      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/40 to-transparent" />
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/60 to-transparent" />

                      <button
                        onClick={goToPrevImage}
                        className="absolute left-4 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/45 text-white backdrop-blur-md transition hover:bg-black/65"
                        type="button"
                      >
                        <ChevronLeft className="h-5 w-5" />
                      </button>

                      <button
                        onClick={goToNextImage}
                        className="absolute right-4 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/45 text-white backdrop-blur-md transition hover:bg-black/65"
                        type="button"
                      >
                        <ChevronRight className="h-5 w-5" />
                      </button>

                      <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/10 bg-black/45 px-3 py-2 backdrop-blur-md">
                        {galleryImages.map((_, index) => (
                          <button
                            key={index}
                            onClick={() => setActiveImageIndex(index)}
                            className={`h-2.5 rounded-full transition-all ${
                              index === activeImageIndex
                                ? 'w-6 bg-white'
                                : 'w-2.5 bg-white/45 hover:bg-white/70'
                            }`}
                            type="button"
                            aria-label={`Go to image ${index + 1}`}
                          />
                        ))}
                      </div>

                      <div className="absolute left-4 top-4 rounded-full border border-white/10 bg-black/45 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-md">
                        {activeImageIndex + 1} / {galleryImages.length}
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className="flex aspect-[4/5] items-center justify-center bg-black text-sm text-white/70">
                  No preview
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="w-[26%] overflow-y-auto bg-[#1d143b] p-6 text-white border-l border-white/10">
            <div className="space-y-6">
            <div>
              <p className="text-white mb-3 text-xs font-semibold uppercase text-muted-foreground">
                Saved In
              </p>

              <Card className="border-white/10 bg-white/5 p-3 backdrop-blur-sm">
                <p className="text-sm font-semibold text-foreground text-white">
                  {linkedBoardNames.length ? linkedBoardNames.join(', ') : 'N/A'}
                </p>
              </Card>
            </div>

            <div>
              <p className="mb-2 text-white text-xs font-semibold uppercase text-muted-foreground">
                Save to Board
              </p>

              <div className="relative">
                <button
                  onClick={() => setShowBoardDropdown((prev) => !prev)}
                  className="w-full cursor-pointer rounded-lg border border-border bg-background px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-muted"
                  type="button"
                  disabled={isSavingBoard}
                >
                  {isSavingBoard ? 'Saving...' : selectedBoard || 'Select subboard...'}
                </button>

                {showBoardDropdown && (
                  <div className="absolute left-0 right-0 top-full z-10 mt-2 max-h-56 overflow-y-auto rounded-lg border border-border bg-card shadow-lg">
                    {subboardsOnly.length > 0 ? (
                      subboardsOnly.map((board) => (
                        <button
                          key={board.id}
                          onClick={() => handleSaveToBoard(board.id, board.fullName)}
                          className="w-full cursor-pointer px-3 py-2 text-left text-sm text-[#120c2b] transition-colors hover:bg-muted"
                          type="button"
                        >
                          {board.fullName}
                        </button>
                      ))
                    ) : (
                      <div className="px-3 py-2 text-sm text-[#120c2b]">
                        No subboards found
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div>
              <p className="mb-3 text-xs font-semibold uppercase text-white">
                Actions
              </p>

              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className={  !hasVideo || isCopyingScript ? " flex h-20 flex-col items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 " : "cursor-pointer flex h-20 flex-col items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 "   }   
                  onClick={handleCopyScript}
                  disabled={!hasVideo || isCopyingScript}
                >
                  <Copy className="h-5 w-5" />
                  <span className="text-xs">
                    {isCopyingScript ? 'Copying...' : 'Copy Script'}
                  </span>
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  className={isDownloadingMedia ? " flex h-20 flex-col items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10"  : "cursor-pointer flex h-20 flex-col items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10"}
                  onClick={handleDownloadMedia}
                  disabled={isDownloadingMedia}
                >
                  <Download className="h-5 w-5" />
                  <span className="text-xs">
                    {isDownloadingMedia ? 'Downloading...' : 'Download'}
                  </span>
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  className={!hasVideo || !previewImage ? "flex h-20 flex-col items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10" : "cursor-pointer flex h-20 flex-col items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10"}
                  onClick={handleDownloadThumbnail}
                  disabled={!hasVideo || !previewImage}
                >
                  <ImageIcon className="h-5 w-5" />
                  <span className="text-xs">Thumbnail</span>
                </Button>

                {ad.ctaUrl ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex h-20 flex-col items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10"
                    asChild
                  >
                    <a href={ad.ctaUrl} target="_blank" rel="noreferrer">
                      <Eye className="h-5 w-5" />
                      <span className="text-xs">View Landing Page</span>
                    </a>
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex h-20 flex-col items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10"                    disabled
                  >
                    <Eye className="h-5 w-5" />
                    <span className="text-xs">View Landing Page</span>
                  </Button>
                )}
              </div>
            </div>

            <div>
              <p className="mb-3 text-xs font-semibold uppercase text-white">
                Status
              </p>

              <Card className="border-white/10 bg-white/5 p-3 backdrop-blur-sm">
                <p className="text-sm font-semibold text-emerald-500">
                  {ad.status || 'N/A'}
                </p>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}