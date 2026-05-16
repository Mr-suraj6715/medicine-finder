import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const id = params.id

  try {
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            inventory: {
              include: {
                medicine: true,
                pharmacy: true,
              }
            }
          }
        }
      }
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    return NextResponse.json({ order })
  } catch (error) {
    console.error('Order detail fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch order details' }, { status: 500 })
  }
}
