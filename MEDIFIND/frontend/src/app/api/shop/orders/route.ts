import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const pharmacyId = searchParams.get('pharmacyId');
  if (!pharmacyId) return NextResponse.json({ error: 'Pharmacy ID required' }, { status: 400 });

  try {
    const orderItems = await prisma.orderItem.findMany({
      where: {
        inventory: {
          pharmacyId,
        },
      },
      include: {
        order: {
          include: {
            user: true,
          },
        },
        inventory: {
          include: {
            medicine: true,
          },
        },
      },
      orderBy: {
        order: {
          createdAt: 'desc',
        },
      },
    });

    // We have to group the order items back into Orders for the frontend to show.
    const orderMap = new Map();
    for (const item of orderItems) {
      const o = item.order;
      if (!orderMap.has(o.id)) {
        orderMap.set(o.id, {
          id: o.trackingNumber || o.id,
          realId: o.id,
          customer: o.user.name || o.user.email,
          items: [],
          total: 0,
          status: o.status,
          isEmergency: o.isEmergency,
          surgeFee: o.surgeFee,
          time: new Date(o.createdAt).toLocaleString(),
        });
      }
      const mappedOrder = orderMap.get(o.id);
      mappedOrder.items.push({
        name: item.inventory.medicine.name,
        qty: item.quantity,
        price: item.priceAtTime,
      });
      mappedOrder.total += item.priceAtTime * item.quantity;
    }

    const orders = Array.from(orderMap.values());
    return NextResponse.json({ orders });
  } catch (error) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { orderId, status } = await req.json();
    const updated = await prisma.order.update({
      where: { id: orderId },
      data: { status },
    });
    return NextResponse.json({ success: true, status: updated.status });
  } catch (error) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
