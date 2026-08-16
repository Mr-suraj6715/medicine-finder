import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Start bulk seeding (1200+ medicines)...')

  // Get pharmacies
  const pharmacies = await prisma.pharmacy.findMany()
  if (pharmacies.length === 0) {
    console.error('No pharmacies found. Run normal seed first.')
    return
  }

  const prefixes = ['Amoxi', 'Dolo', 'Pan', 'Vita', 'Cal', 'Neuro', 'Gastro', 'Cardio', 'Derma', 'Levo', 'Ceti', 'Met', 'Azi', 'Telmi', 'Rosu', 'Ator', 'Pantop', 'Ome', 'Ibu', 'Aceclos']
  const roots = ['cillin', 'phen', 'amol', 'mine', 'plus', 'care', 'max', 'dex', 'tron', 'statin', 'pril', 'sartan', 'prazole', 'floxacin', 'mycin', 'thine', 'tide', 'zole', 'phine', 'ten']
  const suffixes = [' 500mg', ' 1000mg', ' Syrup', ' Gel', ' Forte', ' SR', ' Capsule', ' Injection', ' 250mg', ' 10mg', ' 5mg', ' Drops', ' Susp', ' Ointment']
  const categories = ['Analgesics', 'Supplements', 'Antibiotics', 'Gastrointestinal', 'Cardiovascular', 'Dermatology', 'Respiratory', 'Neurology', 'Antidiabetics', 'Antipyretics']

  const medsData = []
  const inventoryData = []

  let count = 0
  for (const pre of prefixes) {
    for (const root of roots) {
      for (const suff of suffixes) {
        if (count >= 1200) break
        
        const name = `${pre}${root}${suff}`
        const category = categories[Math.floor(Math.random() * categories.length)]
        
        medsData.push({
          name,
          description: `High-quality ${category} medication. Effective for daily care.`,
          category,
          image: '/medicine/placeholder.jpg'
        })
        count++
      }
      if (count >= 1200) break
    }
    if (count >= 1200) break
  }

  console.log(`Generating ${medsData.length} medicines...`)

  // Break into chunks of 100 to avoid large transaction issues
  for (let i = 0; i < medsData.length; i += 100) {
    const chunk = medsData.slice(i, i + 100)
    
    // We need the IDs for inventory, but createMany doesn't return them easily in all Prisma versions
    // So we'll iterate for medicines to get IDs if needed, or just insert and then fetch
    // Since we're in SQLite and IDs are CUIDs or incremental, let's just insert medicines first
  }

  // To simplify, let's do real insertion
  for (const med of medsData) {
    const createdMed = await prisma.medicine.create({ data: med })
    
    // Add to 1-3 random pharmacies
    const numPharmacies = Math.floor(Math.random() * 3) + 1
    const shuffled = [...pharmacies].sort(() => 0.5 - Math.random())
    const selected = shuffled.slice(0, numPharmacies)

    for (const phar of selected) {
      inventoryData.push({
        medicineId: createdMed.id,
        pharmacyId: phar.id,
        price: parseFloat((Math.random() * (500 - 10) + 10).toFixed(2)),
        stock: Math.floor(Math.random() * 200) + 1
      })
    }

    if (inventoryData.length >= 200) {
        await prisma.inventory.createMany({ data: [...inventoryData] })
        inventoryData.length = 0
    }
  }

  if (inventoryData.length > 0) {
    await prisma.inventory.createMany({ data: inventoryData })
  }

  console.log('Bulk seeding finished.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
