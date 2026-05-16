import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// Demo accounts — these always override DB role for these specific credentials
const DEMO_ACCOUNTS = [
  { email: 'demo@medstore.com', password: 'demo123', role: 'user',       name: 'Demo User' },
  { email: 'shop@medstore.com', password: 'shop123', role: 'shop_owner', name: 'MediStore Owner' },
  { email: 'rider@medstore.com', password: 'rider123', role: 'rider',   name: 'Rider Delivery Partner' },
];

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = (body.email || '').trim().toLowerCase();
    const password = body.password || '';

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    // ── 1. Demo accounts ───────────────────────────────────────────
    const demo = DEMO_ACCOUNTS.find(a => a.email === email && a.password === password);
    if (demo) {
      // Make sure demo user exists in DB with correct role
      const dbUser = await prisma.user.upsert({
        where: { email: demo.email },
        update: { role: demo.role },
        create: { email: demo.email, name: demo.name, role: demo.role, loyaltyPoints: 0 },
      });

      if (demo.role === 'shop_owner') {
        await prisma.pharmacy.upsert({
          where: { id: dbUser.id },
          update: {},
          create: { id: dbUser.id, name: `${demo.name} Pharmacy`, location: "Mumbai", rating: 5.0, distance: 1.2 },
        });
      }
      return NextResponse.json({
        success: true,
        user: {
          id: dbUser.id,
          email: dbUser.email,
          name: dbUser.name,
          role: demo.role,                    // always from DEMO_ACCOUNTS
          loyaltyPoints: dbUser.loyaltyPoints,
        },
      });
    }

    // ── 2. Regular DB users (signed up via the signup form) ────────
    const dbUser = await prisma.user.findUnique({ where: { email } });
    if (!dbUser) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    if (dbUser.role === 'shop_owner') {
      await prisma.pharmacy.upsert({
        where: { id: dbUser.id },
        update: {},
        create: { id: dbUser.id, name: `${dbUser.name || 'Shop'} Pharmacy`, location: "Mumbai", rating: 5.0, distance: 2.5 },
      });
    }

    // Role is now stored in the DB — no hardcoding needed
    return NextResponse.json({
      success: true,
      user: {
        id: dbUser.id,
        email: dbUser.email,
        name: dbUser.name,
        role: dbUser.role,                    // read directly from DB
        loyaltyPoints: dbUser.loyaltyPoints,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
