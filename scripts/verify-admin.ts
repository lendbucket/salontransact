import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import bcrypt from 'bcryptjs'

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
})
const prisma = new PrismaClient({ adapter })

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: 'ceo@36west.org' },
  })
  if (!user) {
    console.log('USER NOT FOUND')
    return
  }
  console.log('User:', user.email, '| role:', user.role, '| has password:', !!user.password)
  if (user.password) {
    const valid = await bcrypt.compare('SalonTransact2026!', user.password)
    console.log('Password valid:', valid)
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
