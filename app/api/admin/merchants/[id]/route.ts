import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ADMIN_EMAIL } from '@/lib/admin'
import { prisma } from '@/lib/prisma'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (session?.user?.email !== ADMIN_EMAIL) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const body = await request.json()
  const action = body.action as string

  if (action !== 'suspend' && action !== 'activate') {
    return Response.json({ error: 'Invalid action' }, { status: 400 })
  }

  const merchant = await prisma.merchant.update({
    where: { id },
    data: { status: action === 'suspend' ? 'suspended' : 'active' },
  })

  return Response.json({ success: true, status: merchant.status })
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (session?.user?.email !== ADMIN_EMAIL) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const merchant = await prisma.merchant.findUnique({ where: { id } })
  if (!merchant) {
    return Response.json({ error: 'Merchant not found' }, { status: 404 })
  }

  // Delete merchant first (cascades), then user
  await prisma.merchant.delete({ where: { id } })
  await prisma.user.delete({ where: { id: merchant.userId } })

  return Response.json({ success: true })
}
