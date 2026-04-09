import { NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"
import Board from "@/models/board"
import { getServerSession } from 'next-auth'
import { getToken } from 'next-auth/jwt'
import { authOptions } from '@/lib/auth-options'
import { headers } from 'next/headers'

export async function getSessionUser(req?: NextRequest) {
  // If a request is passed, try token (works for extension with Authorization header)
  if (req) {
    const token = await getToken({
      req,
      secret: process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET,
    })
    if (token?.id) {
      return { userId: String(token.id), unauthorized: null }
    }
  }

  // Fall back to cookie session (works for the web app)
  const session = await getServerSession(authOptions)
  if (session?.user?.id) {
    return { userId: session.user.id, unauthorized: null }
  }

  return {
    userId: null,
    unauthorized: NextResponse.json(
      { success: false, message: 'Unauthorized' },
      { status: 401 }
    ),
  }
}

function normalizeBoard(board: any) {
  return {
    _id: board._id?.toString(),
    name: board.name ?? "",
    slug: board.slug ?? "",
    source: board.source || "app",
    parentBoardId: board.parentBoardId ? board.parentBoardId.toString() : null,
    order: typeof board.order === "number" ? board.order : 0,
    createdAt: board.createdAt ? new Date(board.createdAt).toISOString() : null,
    updatedAt: board.updatedAt ? new Date(board.updatedAt).toISOString() : null,
  }
}

export async function GET(req: NextRequest) {
  const { userId, unauthorized } = await getSessionUser(req)
  if (unauthorized) return unauthorized

  try {
    await connectToDatabase()

    const boards = await Board.find({ userId })
      .sort({ order: 1, createdAt: -1 })
      .lean()

    return NextResponse.json({ success: true, boards: boards.map(normalizeBoard) })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error?.message || "Failed to fetch boards" },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  const { userId, unauthorized } = await getSessionUser(req)
  if (unauthorized) return unauthorized

  try {
    await connectToDatabase()

    const body = await req.json()
    const name = String(body.name || "").trim()
    const slug = String(body.slug || "").trim()
    const parentBoardId = body.parentBoardId?.trim() || null
    const order = Number.isFinite(Number(body.order)) ? Number(body.order) : 0

    if (!name) return NextResponse.json(
      { success: false, message: "Board name is required" }, { status: 400 }
    )
    if (!slug) return NextResponse.json(
      { success: false, message: "Board slug is required" }, { status: 400 }
    )

    // Slug uniqueness is now per-user
    const existingBoard = await Board.findOne({ userId, slug }).lean()
    if (existingBoard) return NextResponse.json(
      { success: false, message: "A board with this slug already exists" }, { status: 409 }
    )

    const board = await Board.create({
      userId,
      name,
      slug,
      parentBoardId,
      order,
      source: body.source || "app",
    })

    return NextResponse.json({ success: true, board: normalizeBoard(board) })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error?.message || "Failed to create board" },
      { status: 500 }
    )
  }
}