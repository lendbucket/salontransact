import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { sendPaymentInstruction } from '@/lib/payroc'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ serial: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { serial } = await params
    const body = await request.json()

    if (!body.order || !body.payment) {
      return NextResponse.json(
        { error: 'Missing required fields: order, payment' },
        { status: 400 }
      )
    }

    const result = await sendPaymentInstruction(serial, body)
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
