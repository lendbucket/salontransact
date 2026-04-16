import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export async function POST(request: Request) {
  try {
    const { token, password, confirmPassword } = (await request.json()) as {
      token: string
      password: string
      confirmPassword: string
    }

    if (!token || !password || !confirmPassword) {
      return Response.json({ error: 'All fields are required' }, { status: 400 })
    }
    if (password.length < 8) {
      return Response.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      )
    }
    if (password !== confirmPassword) {
      return Response.json({ error: 'Passwords do not match' }, { status: 400 })
    }

    const reset = await prisma.passwordReset.findUnique({ where: { token } })
    if (!reset) {
      return Response.json({ error: 'Invalid reset link' }, { status: 400 })
    }
    if (reset.used) {
      return Response.json(
        { error: 'This reset link has already been used' },
        { status: 400 }
      )
    }
    if (reset.expiresAt < new Date()) {
      return Response.json(
        { error: 'This reset link has expired. Please request a new one.' },
        { status: 400 }
      )
    }

    const hashed = bcrypt.hashSync(password, 12)

    await prisma.user.update({
      where: { email: reset.email },
      data: { password: hashed },
    })

    await prisma.passwordReset.update({
      where: { id: reset.id },
      data: { used: true },
    })

    return Response.json({ success: true })
  } catch (err) {
    console.error('Reset password error:', err)
    return Response.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
