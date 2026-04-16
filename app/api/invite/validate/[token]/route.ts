import { prisma } from '@/lib/prisma'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  const invite = await prisma.invite.findUnique({ where: { token } })
  if (!invite) {
    return Response.json({ error: 'Invalid invitation' }, { status: 404 })
  }
  if (invite.used) {
    return Response.json({ error: 'This invitation has already been used' }, { status: 400 })
  }
  if (invite.expiresAt < new Date()) {
    return Response.json(
      { error: 'This invitation has expired. Contact your administrator.' },
      { status: 400 }
    )
  }

  return Response.json({ valid: true, email: invite.email })
}
