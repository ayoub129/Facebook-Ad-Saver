import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const url = req.nextUrl.searchParams.get('url')

    if (!url) {
      return NextResponse.json(
        { success: false, message: 'Missing url parameter' },
        { status: 400 }
      )
    }

    let parsed: URL
    try {
      parsed = new URL(url)
    } catch {
      return NextResponse.json(
        { success: false, message: 'Invalid URL' },
        { status: 400 }
      )
    }

    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return NextResponse.json(
        { success: false, message: 'Only http/https URLs are allowed' },
        { status: 400 }
      )
    }

    const upstream = await fetch(parsed.toString(), {
      method: 'GET',
      cache: 'no-store',
    })

    if (!upstream.ok) {
      return NextResponse.json(
        {
          success: false,
          message: `Upstream request failed with status ${upstream.status}`,
        },
        { status: 502 }
      )
    }

    const contentType =
      upstream.headers.get('content-type') || 'application/octet-stream'

    const arrayBuffer = await upstream.arrayBuffer()

    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('Media proxy failed:', error)

    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Proxy failed',
      },
      { status: 500 }
    )
  }
}