import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import os from 'os'
import path from 'path'
import crypto from 'crypto'
import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

export const runtime = 'nodejs'

function uniqueName(prefix: string, ext: string) {
  return `${prefix}-${Date.now()}-${crypto.randomUUID()}.${ext}`
}

async function downloadFile(url: string, outputPath: string) {
  const res = await fetch(url, { cache: 'no-store' })

  if (!res.ok) {
    throw new Error('Failed to fetch remote video')
  }

  const arrayBuffer = await res.arrayBuffer()
  await fs.promises.writeFile(outputPath, Buffer.from(arrayBuffer))
}

async function cleanup(paths: string[]) {
  await Promise.all(
    paths.map(async (filePath) => {
      try {
        await fs.promises.unlink(filePath)
      } catch {}
    })
  )
}

/**
 * Replace this with your real transcription logic.
 * Example options:
 * - OpenAI audio transcription
 * - local whisper
 * - Deepgram
 * - AssemblyAI
 */
async function transcribeAudio(audioPath: string): Promise<string> {
  // Example stub:
  // 1. Send `audioPath` file to your transcription provider
  // 2. Return transcript text

  throw new Error(
    'transcribeAudio() is not connected yet. Hook it to your STT backend.'
  )
}

export async function POST(request: NextRequest) {
  const tempDir = os.tmpdir()
  const videoPath = path.join(tempDir, uniqueName('ad-video', 'mp4'))
  const audioPath = path.join(tempDir, uniqueName('ad-audio', 'mp3'))

  try {
    const body = await request.json().catch(() => null)
    const videoUrl = body?.videoUrl

    if (!videoUrl || typeof videoUrl !== 'string') {
      return NextResponse.json(
        { success: false, message: 'Missing videoUrl' },
        { status: 400 }
      )
    }

    await downloadFile(videoUrl, videoPath)

    await execFileAsync('ffmpeg', [
      '-y',
      '-i',
      videoPath,
      '-vn',
      '-acodec',
      'libmp3lame',
      '-ar',
      '16000',
      '-ac',
      '1',
      audioPath,
    ])

    const script = await transcribeAudio(audioPath)

    return NextResponse.json({
      success: true,
      script: script || '',
    })
  } catch (error) {
    console.error('Extract script error:', error)

    const message =
      error instanceof Error ? error.message : 'Failed to extract script'

    return NextResponse.json(
      { success: false, message },
      { status: 500 }
    )
  } finally {
    await cleanup([videoPath, audioPath])
  }
}