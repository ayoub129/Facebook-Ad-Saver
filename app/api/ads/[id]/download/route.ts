import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)

    const videoUrl = body?.videoUrl
    const type = body?.type || 'video'

    if (!videoUrl || typeof videoUrl !== 'string') {
      return NextResponse.json(
        { success: false, message: 'Missing videoUrl' },
        { status: 400 }
      )
    }

    if (type !== 'video') {
      return NextResponse.json(
        { success: false, message: 'Invalid download type' },
        { status: 400 }
      )
    }

    const upstream = await fetch(videoUrl, {
      cache: 'no-store',
    })

    if (!upstream.ok) {
      return NextResponse.json(
        { success: false, message: 'Failed to fetch remote video' },
        { status: 400 }
      )
    }

    const contentType =
      upstream.headers.get('content-type') || 'video/mp4'

    const arrayBuffer = await upstream.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': 'attachment; filename="ad-video.mp4"',
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('Download video error:', error)

    return NextResponse.json(
      { success: false, message: 'Failed to download video' },
      { status: 500 }
    )
  }
}