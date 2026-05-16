import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// GET - list all medicines for shop owner management
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const pharmacyId = searchParams.get('pharmacyId');

  try {
    if (pharmacyId) {
      const inventory = await prisma.inventory.findMany({
        where: { pharmacyId },
        include: { medicine: true },
        orderBy: { medicine: { name: 'asc' } },
      });
      return NextResponse.json({ inventory });
    }

    const medicines = await prisma.medicine.findMany({ orderBy: { name: 'asc' } });
    return NextResponse.json({ medicines });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}

// POST - update stock or add medicine
export async function POST(req: Request) {
  try {
    const { pharmacyId, medicineId, price, stock, action, medicineName, description, category } = await req.json();

    if (action === 'add_medicine') {
      const med = await prisma.medicine.create({
        data: { name: medicineName, description, category, indications: '' },
      });
      if (pharmacyId) {
        await prisma.inventory.create({
          data: { medicineId: med.id, pharmacyId, price: price || 0, stock: stock || 0 },
        });
      }
      return NextResponse.json({ success: true, medicine: med });
    }

    if (action === 'update_stock') {
      const updated = await prisma.inventory.update({
        where: { medicineId_pharmacyId: { medicineId, pharmacyId } },
        data: { stock, price },
      });
      if (category !== undefined) {
        await prisma.medicine.update({
          where: { id: medicineId },
          data: { category },
        });
      }
      return NextResponse.json({ success: true, inventory: updated });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
