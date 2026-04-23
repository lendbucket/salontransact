import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import bcrypt from 'bcryptjs'

const adapter = new PrismaPg({
  connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
})
const prisma = new PrismaClient({ adapter })

async function main() {
  const email = 'ceo@36west.org'
  const password = 'SalonTransact2026!'

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    const hashed = await bcrypt.hash(password, 12)
    await prisma.user.update({
      where: { email },
      data: { password: hashed, role: 'admin', name: 'Robert Reyna' },
    })
    console.log('Admin user updated:', email)
    return
  }

  const hashed = await bcrypt.hash(password, 12)
  await prisma.user.create({
    data: {
      email,
      name: 'Robert Reyna',
      password: hashed,
      role: 'admin',
    },
  })
  console.log('Admin user created:', email)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
