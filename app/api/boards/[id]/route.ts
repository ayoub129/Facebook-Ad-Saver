import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import Board from '@/models/board'
import Ad from '@/models/Ad'

function normalizeBoard(board: any) {
  return {
    _id: board._id?.toString(),
    name: board.name ?? '',
    slug: board.slug ?? '',
    parentBoardId: board.parentBoardId ? board.parentBoardId.toString() : null,
    order: typeof board.order === 'number' ? board.order : 0,
    createdAt: board.createdAt ? new Date(board.createdAt).toISOString() : null,
    updatedAt: board.updatedAt ? new Date(board.updatedAt).toISOString() : null,
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectToDatabase()

    const { id } = await params
    const body = await req.json()

    const board = await Board.findById(id)
    if (!board) {
      return NextResponse.json(
        { success: false, message: 'Board not found' },
        { status: 404 }
      )
    }

    if (typeof body.name === 'string' && body.name.trim()) {
      board.name = body.name.trim()
    }

    if (typeof body.slug === 'string' && body.slug.trim()) {
      board.slug = body.slug.trim()
    }

    if (body.parentBoardId !== undefined) {
      board.parentBoardId = body.parentBoardId || null
    }

    if (typeof body.order === 'number') {
      board.order = body.order
    }

    await board.save()

    return NextResponse.json({
      success: true,
      board: normalizeBoard(board),
    })
  } catch (error: any) {
    console.error('PATCH /api/boards/[id] error:', error)

    return NextResponse.json(
      {
        success: false,
        message: error?.message || 'Failed to update board',
      },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectToDatabase()

    const { id } = await params

    const board = await Board.findById(id)
    if (!board) {
      return NextResponse.json(
        { success: false, message: 'Board not found' },
        { status: 404 }
      )
    }

    if (!board.parentBoardId) {
      const subboards = await Board.find({ parentBoardId: id }).lean()
      const subboardIds = subboards.map((item: any) => item._id)

      if (subboardIds.length > 0) {
        await Ad.deleteMany({ boardIds: { $in: subboardIds } })
        await Board.deleteMany({ parentBoardId: id })
      }
    } else {
      await Ad.deleteMany({ boardIds: id })
    }

    await Board.findByIdAndDelete(id)

    return NextResponse.json({
      success: true,
    })
  } catch (error: any) {
    console.error('DELETE /api/boards/[id] error:', error)

    return NextResponse.json(
      {
        success: false,
        message: error?.message || 'Failed to delete board',
      },
      { status: 500 }
    )
  }
}