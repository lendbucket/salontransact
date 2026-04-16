import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import bcrypt from 'bcryptjs'

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
})
const prisma = new PrismaClient({ adapter })

async function main() {
  const email = 'ceo@36west.org'
  const password = 'Basketball123!'

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    console.log('Admin user already exists')
    return
  }

  const hashed = await bcrypt.hash(password, 12)

  const user = await prisma.user.create({
    data: {
      email,
      name: 'Robert Reyna',
      password: hashed,
      role: 'admin',
    }
  })

  console.log('Admin user created:', user.email)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
