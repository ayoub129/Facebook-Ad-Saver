import { NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"
import Board from "@/models/board"

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

export async function GET() {
  try {
    await connectToDatabase()

    const boards = await Board.find({})
      .sort({ order: 1, createdAt: -1 })
      .lean()

    return NextResponse.json({
      success: true,
      boards: boards.map(normalizeBoard),
    })
  } catch (error: any) {
    console.error("GET /api/boards error:", error)

    return NextResponse.json(
      {
        success: false,
        message: error?.message || "Failed to fetch boards",
      },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    await connectToDatabase()

    const body = await req.json()

    const name = String(body.name || "").trim()
    const slug = String(body.slug || "").trim()
    const parentBoardId =
      body.parentBoardId && String(body.parentBoardId).trim() !== ""
        ? String(body.parentBoardId)
        : null
    const order = Number.isFinite(Number(body.order)) ? Number(body.order) : 0

    if (!name) {
      return NextResponse.json(
        { success: false, message: "Board name is required" },
        { status: 400 }
      )
    }

    if (!slug) {
      return NextResponse.json(
        { success: false, message: "Board slug is required" },
        { status: 400 }
      )
    }

    const existingBoard = await Board.findOne({ slug }).lean()

    if (existingBoard) {
      return NextResponse.json(
        { success: false, message: "A board with this slug already exists" },
        { status: 409 }
      )
    }

    const board = await Board.create({
      name,
      slug,
      parentBoardId,
      order,
      source: body.source || "app",
    })

    return NextResponse.json({
      success: true,
      board: normalizeBoard(board),
    })
  } catch (error: any) {
    console.error("POST /api/boards error:", error)

    return NextResponse.json(
      {
        success: false,
        message: error?.message || "Failed to create board",
      },
      { status: 500 }
    )
  }
}