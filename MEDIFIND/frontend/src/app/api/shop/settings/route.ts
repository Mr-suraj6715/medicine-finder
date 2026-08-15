import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const pharmacyId = searchParams.get('pharmacyId');
  if (!pharmacyId) return NextResponse.json({ error: 'Pharmacy ID required' }, { status: 400 });

  try {
    const pharmacy = await prisma.pharmacy.findUnique({ where: { id: pharmacyId } });
    if (!pharmacy) return NextResponse.json({ error: 'Pharmacy not found' }, { status: 404 });
    return NextResponse.json({ pharmacy });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { pharmacyId, name, location, phone, openingTime, closingTime, isAvailable } = await req.json();
    if (!pharmacyId) return NextResponse.json({ error: 'Pharmacy ID required' }, { status: 400 });

    const updated = await prisma.pharmacy.update({
      where: { id: pharmacyId },
      data: {
        ...(name !== undefined && { name }),
        ...(location !== undefined && { location }),
        ...(phone !== undefined && { phone }),
        ...(openingTime !== undefined && { openingTime }),
        ...(closingTime !== undefined && { closingTime }),
        ...(isAvailable !== undefined && { isAvailable }),
      },
    });

    return NextResponse.json({ success: true, pharmacy: updated });
  } catch (error) {
    console.error('Settings update error:', error);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}
