import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Start seeding rider data...')

  // 1. Create or get Rider
  const rider = await prisma.user.upsert({
    where: { email: 'rider@medstore.com' },
    update: { role: 'rider' },
    create: {
      email: 'rider@medstore.com',
      name: 'Rider Delivery Partner',
      role: 'rider',
    },
  })

  // 2. Get a customer user
  let customer = await prisma.user.findFirst({ where: { role: 'user' } });
  if (!customer) {
    customer = await prisma.user.create({
      data: { email: 'customer@demo.com', name: 'Demo Customer', role: 'user' }
    });
  }

  // 3. Get pharmacy inventory
  const sampleInv = await prisma.inventory.findFirst({
     include: { pharmacy: true }
  });

  if (!sampleInv) {
    console.log("No inventory found, please run standard seed first.");
    return;
  }

  // 4. Create Available Order
  await prisma.order.create({
    data: {
      userId: customer.id,
      totalAmount: 145.00,
      status: "PROCESSING",
      trackingNumber: "MF-AV-001",
      items: {
        create: [
          { inventoryId: sampleInv.id, quantity: 2, priceAtTime: sampleInv.price }
        ]
      }
    }
  });

  // 5. Create Active Order
  await prisma.order.create({
    data: {
      userId: customer.id,
      riderId: rider.id,
      totalAmount: 210.00,
      status: "OUT_FOR_DELIVERY",
      trackingNumber: "MF-AC-002",
      items: {
        create: [
          { inventoryId: sampleInv.id, quantity: 3, priceAtTime: sampleInv.price }
        ]
      }
    }
  });

  // 6. Create History Order (Emergency)
  await prisma.order.create({
    data: {
      userId: customer.id,
      riderId: rider.id,
      totalAmount: 360.00,
      status: "DELIVERED",
      isEmergency: true,
      surgeFee: 60.00,
      driverEarnings: 60.00,
      trackingNumber: "MF-HI-003",
      items: {
        create: [
          { inventoryId: sampleInv.id, quantity: 5, priceAtTime: sampleInv.price }
        ]
      }
    }
  });

  console.log('Rider seeding finished.')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
