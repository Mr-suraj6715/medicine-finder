import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Start seeding...')

  // Upsert a default user
  const user = await prisma.user.upsert({
    where: { email: 'user@example.com' },
    update: {},
    create: {
      email: 'user@example.com',
      name: 'Suraj Yadav',
      loyaltyPoints: 4,
    },
  })

  // Medicines
  const paracetamol = await prisma.medicine.create({
    data: {
      name: 'Paracetamol 500mg',
      description: '10 Tablets / Strip • Generic',
      category: 'Analgesics',
      image: '/medicine/paracetamol.jpg',
    },
  })

  const vitaminC = await prisma.medicine.create({
    data: {
      name: 'Vitamin C 1000mg',
      description: '20 Effervescent Tablets',
      category: 'Supplements',
      image: '/medicine/vitaminc.jpg',
    },
  })

  // Pharmacies
  const apollo = await prisma.pharmacy.create({
    data: {
      name: 'Apollo Pharmacy',
      location: 'Mumbai, MH',
      rating: 4.2,
      distance: 0.8,
    },
  })

  const healthPlus = await prisma.pharmacy.create({
    data: {
      name: 'HealthPlus Medicos',
      location: 'Mumbai, MH',
      rating: 4.8,
      distance: 1.2,
    },
  })

  const cityPharma = await prisma.pharmacy.create({
    data: {
      name: 'City Pharma',
      location: 'Mumbai, MH',
      rating: 3.1,
      distance: 0.3,
    },
  })

  // Inventory entries (Linking medicines to pharmacies)
  await prisma.inventory.createMany({
    data: [
      { medicineId: paracetamol.id, pharmacyId: apollo.id, price: 15.00, stock: 100 },
      { medicineId: paracetamol.id, pharmacyId: healthPlus.id, price: 18.50, stock: 50 },
      { medicineId: paracetamol.id, pharmacyId: cityPharma.id, price: 20.00, stock: 30 },
      
      { medicineId: vitaminC.id, pharmacyId: apollo.id, price: 45.00, stock: 20 },
      { medicineId: vitaminC.id, pharmacyId: healthPlus.id, price: 42.00, stock: 60 },
    ],
  })

  console.log('Seeding finished.')
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
