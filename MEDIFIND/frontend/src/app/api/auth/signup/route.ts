import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const { name, email, password, phone, location, role } = await req.json();
    const normalizedEmail = (email || '').trim().toLowerCase();

    if (!name || !normalizedEmail || !password) {
      return NextResponse.json({ error: 'Name, email and password are required' }, { status: 400 });
    }

    // Check if email already exists
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 409 });
    }

    const userRole = (role === 'shop_owner' || role === 'rider') ? role : 'user';

    // Save to DB — role is persisted in the DB now
    const user = await prisma.user.create({
      data: {
        name,
        email: normalizedEmail,
        role: userRole,   // ← stored in DB so login can read it back
        loyaltyPoints: 0,
      },
    });

    if (userRole === 'shop_owner') {
      await prisma.pharmacy.create({
        data: {
          id: user.id,
          name: `${name || 'Shop'} Pharmacy`,
          location: location || 'Mumbai',
          rating: 5.0,
          distance: 1.5,
        },
      });
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        loyaltyPoints: 0,
      },
    });
  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
