import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const email = searchParams.get('email') || 'user@example.com'

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { loyaltyPoints: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({ loyaltyPoints: user.loyaltyPoints })
  } catch (error) {
    console.error('Loyalty fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch loyalty points' }, { status: 500 })
  }
}
