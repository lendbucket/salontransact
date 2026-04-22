import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getPayment, refundPayment, reversePayment } from '@/lib/payroc'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const payment = await getPayment(id)
    return NextResponse.json(payment)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const action = body.action as string

    if (action === 'refund') {
      const result = await refundPayment(id, {
        amount: body.amount,
        reason: body.reason,
      })
      return NextResponse.json(result)
    }

    if (action === 'reverse') {
      const result = await reversePayment(id)
      return NextResponse.json(result)
    }

    return NextResponse.json(
      { error: 'Invalid action. Use "refund" or "reverse"' },
      { status: 400 }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
