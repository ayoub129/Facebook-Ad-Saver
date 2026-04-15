import { NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"
import Board from "@/models/board"
import { User } from "@/models/User"
import { getServerSession } from 'next-auth'
import { getToken } from 'next-auth/jwt'
import { authOptions } from '@/lib/auth-options'
import { headers } from 'next/headers'
import { canEditBoard, resolveBoardAccess } from "@/lib/board-access"

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

function normalizeBoard(board: any, accessRole: string, accessSource: string) {
  return {
    _id: board._id?.toString(),
    name: board.name ?? "",
    slug: board.slug ?? "",
    source: board.source || "app",
    parentBoardId: board.parentBoardId ? board.parentBoardId.toString() : null,
    order: typeof board.order === "number" ? board.order : 0,
    accessRole,
    accessSource,
    isOwnedByMe: accessRole === "owner",
    isSharedWithMe: accessRole !== "owner",
    createdAt: board.createdAt ? new Date(board.createdAt).toISOString() : null,
    updatedAt: board.updatedAt ? new Date(board.updatedAt).toISOString() : null,
  }
}

export async function GET(req: NextRequest) {
  const shareToken = req.nextUrl.searchParams.get("shareToken")
  const session = await getSessionUser(req)
  if (session.unauthorized && !shareToken) return session.unauthorized
  const userId = session.userId ? String(session.userId) : ""

  try {
    await connectToDatabase()
    const user = userId ? await User.findById(userId).select("email").lean() : null
    const email = user?.email || ""

    const boards = await Board.find({})
      .sort({ order: 1, createdAt: 1 })
      .lean()

    const boardById = new Map<string, any>()
    for (const board of boards) {
      boardById.set(String(board._id), board)
    }

    const effectiveAccess = new Map<string, ReturnType<typeof resolveBoardAccess>>()
    const resolveEffective = (board: any): ReturnType<typeof resolveBoardAccess> => {
      const id = String(board._id)
      const cached = effectiveAccess.get(id)
      if (cached) return cached

      let direct = resolveBoardAccess(
        board,
        { userId, email },
        { shareToken }
      )

      if (board.parentBoardId) {
        const parent = boardById.get(String(board.parentBoardId))
        if (parent) {
          const parentAccess = resolveEffective(parent)
          if (parentAccess.role !== "none" && direct.role === "none") {
            direct = parentAccess
          }
        }
      }

      effectiveAccess.set(id, direct)
      return direct
    }

    const visibleBoards = boards.filter((board) => resolveEffective(board).role !== "none")

    return NextResponse.json({
      success: true,
      boards: visibleBoards.map((board) => {
        const access = resolveEffective(board)
        return normalizeBoard(board, access.role, access.source)
      }),
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error?.message || "Failed to fetch boards" },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  const shareToken = req.nextUrl.searchParams.get("shareToken")
  const session = await getSessionUser(req)
  if (session.unauthorized && !shareToken) return session.unauthorized
  const userId = session.userId ? String(session.userId) : ""

  try {
    await connectToDatabase()
    const user = userId ? await User.findById(userId).select("email").lean() : null
    const email = user?.email || ""

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

    let ownerUserId = String(userId || "")
    if (parentBoardId) {
      const parentBoard = await Board.findById(parentBoardId).lean()
      if (!parentBoard) {
        return NextResponse.json(
          { success: false, message: "Parent board not found" },
          { status: 404 }
        )
      }

      const canEditParent = canEditBoard(
        parentBoard,
        { userId, email },
        { shareToken }
      )
      if (!canEditParent) {
        return NextResponse.json(
          { success: false, message: "Forbidden" },
          { status: 403 }
        )
      }
      ownerUserId = String(parentBoard.userId)
    } else if (!userId) {
      return NextResponse.json(
        { success: false, message: "Authentication required to create top-level boards" },
        { status: 401 }
      )
    }

    const existingBoard = await Board.findOne({ userId: ownerUserId, slug }).lean()
    if (existingBoard) return NextResponse.json(
      { success: false, message: "A board with this slug already exists" }, { status: 409 }
    )

    const board = await Board.create({
      userId: ownerUserId,
      name,
      slug,
      parentBoardId,
      order,
      source: body.source || "app",
    })

    const access = resolveBoardAccess(
      board,
      { userId, email },
      { shareToken }
    )
    return NextResponse.json({ success: true, board: normalizeBoard(board, access.role, access.source) })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error?.message || "Failed to create board" },
      { status: 500 }
    )
  }
}