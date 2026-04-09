import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { NextResponse } from 'next/server'

export async function getSessionUser() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    return { userId: null, unauthorized: NextResponse.json(
      { success: false, message: 'Unauthorized' },
      { status: 401 }
    )}
  }

  return { userId: session.user.id, unauthorized: null }
}