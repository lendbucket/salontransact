import { prisma } from '@/lib/prisma'

export async function POST(request: Request) {
  try {
    const { token } = (await request.json()) as { token: string }
    if (!token) {
      return Response.json({ error: 'Token is required' }, { status: 400 })
    }

    const reset = await prisma.passwordReset.findUnique({ where: { token } })
    if (!reset) {
      return Response.json(
        { error: 'This link is invalid' },
        { status: 400 }
      )
    }
    if (reset.used) {
      return Response.json(
        { error: 'This link has already been used' },
        { status: 400 }
      )
    }
    if (reset.expiresAt < new Date()) {
      return Response.json(
        { error: 'This link has expired' },
        { status: 400 }
      )
    }

    // Don't mark as used yet — the credentials provider will do that
    // Return the token back so the client can use it with MAGIC: prefix
    return Response.json({
      success: true,
      email: reset.email,
      code: reset.token,
    })
  } catch (err) {
    console.error('Magic verify error:', err)
    return Response.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
