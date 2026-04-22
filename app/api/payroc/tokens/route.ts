import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createSecureToken } from '@/lib/payroc'

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    if (!body.cardAccount) {
      return NextResponse.json(
        { error: 'Missing required field: cardAccount' },
        { status: 400 }
      )
    }

    const token = await createSecureToken(body)
    return NextResponse.json(token)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
