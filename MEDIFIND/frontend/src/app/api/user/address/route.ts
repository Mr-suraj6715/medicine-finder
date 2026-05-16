import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId');
  if (!userId) return NextResponse.json({ error: 'User ID required' }, { status: 400 });

  try {
    const addresses = await prisma.address.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });
    return NextResponse.json({ addresses });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch addresses' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { userId, label, address, latitude, longitude } = await req.json();
    if (!userId || !label || !address) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const newAddress = await prisma.address.create({
      data: {
        userId,
        label,
        address,
        latitude: latitude || null,
        longitude: longitude || null
      }
    });

    return NextResponse.json({ success: true, address: newAddress });
  } catch (error) {
    console.error('Address creation error:', error);
    return NextResponse.json({ error: 'Failed to create address' }, { status: 500 });
  }
}
