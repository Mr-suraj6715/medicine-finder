import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Updating medicines with indications...')

  const medicines = [
    { name: 'Paracetamol 500mg', indications: 'fever, pain, headache, bodyache' },
    { name: 'Vitamin C 1000mg', indications: 'immunity, weakness, cold' },
    { name: 'Dolo 650', indications: 'fever, severe pain, headache' },
    { name: 'CoughSyp Clear', indications: 'cough, sore throat, dry cough' },
    { name: 'Amoxicillin', indications: 'infection, bacterial infection, sore throat' },
    { name: 'Cetirizine', indications: 'allergy, sneezing, runny nose, itching' },
    { name: 'Ibuprofen', indications: 'pain, inflammation, swelling' },
    { name: 'Omeprazole', indications: 'acidity, gas, heartburn' },
    { name: 'ORS Powder', indications: 'dehydration, diarrhea, weakness' },
  ]

  for (const med of medicines) {
    await prisma.medicine.updateMany({
      where: { name: { contains: med.name } },
      data: { indications: med.indications },
    })
  }

  // Create some new ones if they don't exist
  for (const med of medicines) {
    const existing = await prisma.medicine.findFirst({ where: { name: med.name } })
    if (!existing) {
       await prisma.medicine.create({
         data: {
           name: med.name,
           description: 'Medical store verified',
           category: 'General',
           indications: med.indications
         }
       })
    }
  }

  console.log('Symptoms seeding finished.')
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
