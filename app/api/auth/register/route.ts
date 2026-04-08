import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { connectToDatabase } from '@/lib/mongodb'
import { User } from '@/models/User'

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters'),
  email: z.string().trim().email('Invalid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const parsed = registerSchema.safeParse(body)

    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors
      return NextResponse.json(
        { success: false, errors: fieldErrors },
        { status: 400 }
      )
    }

    await connectToDatabase()

    const name = parsed.data.name.trim()
    const email = parsed.data.email.trim().toLowerCase()
    const password = parsed.data.password

    const existingUser = await User.findOne({ email }).lean()
    if (existingUser) {
      return NextResponse.json(
        {
          success: false,
          message: 'Email already in use',
        },
        { status: 409 }
      )
    }

    const passwordHash = await bcrypt.hash(password, 12)

    await User.create({
      name,
      email,
      passwordHash,
    })

    return NextResponse.json({
      success: true,
      message: 'Account created successfully',
    })
  } catch (error) {
    console.error('Register error:', error)
    return NextResponse.json(
      {
        success: false,
        message: 'Something went wrong while creating the account',
      },
      { status: 500 }
    )
  }
}