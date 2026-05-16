import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Attempting manual migration...')
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "Order" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'PENDING'`)
    console.log('Added status column')
  } catch (e) {
    console.log('Status column might already exist or error:', e)
  }

  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "Order" ADD COLUMN "trackingNumber" TEXT`)
    console.log('Added trackingNumber column')
  } catch (e) {
    console.log('TrackingNumber column might already exist or error:', e)
  }

  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "Order" ADD COLUMN "estimatedDelivery" DATETIME`)
    console.log('Added estimatedDelivery column')
  } catch (e) {
    console.log('EstimatedDelivery column might already exist or error:', e)
  }

  console.log('Migration attempt finished.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
