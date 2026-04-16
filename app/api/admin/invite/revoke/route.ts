import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ADMIN_EMAIL } from '@/lib/admin'
import { prisma } from '@/lib/prisma'

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (session?.user?.email !== ADMIN_EMAIL) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const inviteId = body.inviteId as string

  await prisma.invite.update({
    where: { id: inviteId },
    data: { used: true, usedAt: new Date() },
  })

  return Response.json({ success: true })
}
