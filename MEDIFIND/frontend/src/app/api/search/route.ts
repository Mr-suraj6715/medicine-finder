import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');

  if (!query) {
    return NextResponse.json({ medicines: [] });
  }

  try {
    const medicines = await prisma.medicine.findMany({
      where: {
        OR: [
          { name: { contains: query } },
          { description: { contains: query } },
          { category: { contains: query } },
        ],
      },
      include: {
        inventory: {
          include: { pharmacy: true },
        },
      },
    });

    return NextResponse.json({ medicines });
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json({ error: 'Failed to fetch medicines' }, { status: 500 });
  }
}
