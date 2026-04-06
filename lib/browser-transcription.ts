'use client'

import { pipeline } from '@huggingface/transformers'
import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile } from '@ffmpeg/util'

let ffmpegInstance: FFmpeg | null = null
let transcriberPromise: Promise<any> | null = null

async function getFFmpeg() {
  if (ffmpegInstance) return ffmpegInstance

  const ffmpeg = new FFmpeg()

  await ffmpeg.load()
  ffmpegInstance = ffmpeg
  return ffmpeg
}

async function getTranscriber() {
  if (!transcriberPromise) {
    transcriberPromise = pipeline(
      'automatic-speech-recognition',
      'Xenova/whisper-tiny.en',
      {
        device: 'webgpu',
        dtype: 'q4',
      }
    ).catch(async () => {
      return pipeline(
        'automatic-speech-recognition',
        'Xenova/whisper-tiny.en',
        {
          device: 'wasm',
          dtype: 'q8',
        }
      )
    })
  }

  return transcriberPromise
}

function interleavedToMono(
  channelData: Float32Array[],
  length: number
): Float32Array {
  if (channelData.length === 1) return channelData[0]

  const mono = new Float32Array(length)
  const channels = channelData.length

  for (let i = 0; i < length; i++) {
    let sum = 0
    for (let c = 0; c < channels; c++) {
      sum += channelData[c][i] || 0
    }
    mono[i] = sum / channels
  }

  return mono
}

async function decodeAudioBuffer(audioFile: Uint8Array) {
  const audioContext = new AudioContext({ sampleRate: 16000 })
  const arrayBuffer = audioFile.buffer.slice(
    audioFile.byteOffset,
    audioFile.byteOffset + audioFile.byteLength
  )

  const decoded = await audioContext.decodeAudioData(arrayBuffer)
  const channels: Float32Array[] = []

  for (let i = 0; i < decoded.numberOfChannels; i++) {
    channels.push(decoded.getChannelData(i))
  }

  const mono = interleavedToMono(channels, decoded.length)
  return { audio: mono, sampleRate: decoded.sampleRate }
}

export async function transcribeVideoUrlInBrowser(videoUrl: string) {
  const ffmpeg = await getFFmpeg()

  const inputName = `input-${Date.now()}.mp4`
  const outputName = `output-${Date.now()}.wav`

  const proxyUrl = `/api/media/proxy?url=${encodeURIComponent(videoUrl)}`
const videoResponse = await fetch(proxyUrl, {
  method: 'GET',
  cache: 'no-store',
})

  if (!videoResponse.ok) {
    throw new Error('Failed to fetch video file')
  }

  const videoBlob = await videoResponse.blob()
  const videoData = await fetchFile(videoBlob)

  await ffmpeg.writeFile(inputName, videoData)

  await ffmpeg.exec([
    '-i',
    inputName,
    '-vn',
    '-acodec',
    'pcm_s16le',
    '-ar',
    '16000',
    '-ac',
    '1',
    outputName,
  ])

  const wavData = await ffmpeg.readFile(outputName)
  const wavBytes =
    wavData instanceof Uint8Array ? wavData : new Uint8Array(wavData as ArrayBuffer)

  const { audio } = await decodeAudioBuffer(wavBytes)

  const transcriber = await getTranscriber()

  const result = await transcriber(audio, {
    chunk_length_s: 20,
    stride_length_s: 5,
    return_timestamps: false,
  })

  try {
    await ffmpeg.deleteFile(inputName)
    await ffmpeg.deleteFile(outputName)
  } catch {}

  return typeof result?.text === 'string' ? result.text.trim() : ''
}