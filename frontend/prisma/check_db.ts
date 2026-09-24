import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const orders = await prisma.order.findMany({
    select: { id: true, status: true, riderId: true, isEmergency: true }
  });
  console.log("DB ORDERS:", JSON.stringify(orders, null, 2));
}

main().catch(console.error);
