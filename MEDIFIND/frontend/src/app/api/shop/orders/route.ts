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
            rider: true,
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

    // Group order items into Orders
    const orderMap = new Map();
    for (const item of orderItems) {
      const o = item.order;
      if (!orderMap.has(o.id)) {
        // Find cancelled rider info if cancelledRiderId is present
        let cancelledRiderName = null;

        orderMap.set(o.id, {
          id: o.trackingNumber || o.id,
          realId: o.id,
          customer: o.user.name || o.user.email,
          customerEmail: o.user.email,
          customerAddress: o.deliveryAddress || "Mumbai, MH",
          items: [],
          total: 0,
          status: o.status,
          isEmergency: o.isEmergency,
          surgeFee: o.surgeFee,
          riderId: o.riderId,
          riderName: o.rider?.name || o.rider?.email || null,
          riderPhone: o.rider?.phone || null,
          riderRating: o.rider?.riderRating || null,
          cancelledRiderId: o.cancelledRiderId,
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

    // Resolve cancelled rider names if needed
    const orders = Array.from(orderMap.values());
    for (const o of orders) {
      if (o.cancelledRiderId && !o.cancelledRiderName) {
        const cRider = await prisma.user.findUnique({ where: { id: o.cancelledRiderId } });
        if (cRider) {
          o.cancelledRiderName = cRider.name || cRider.email;
        }
      }
    }

    return NextResponse.json({ orders });
  } catch (error) {
    console.error("Fetch shop orders error:", error);
    return NextResponse.json({ error: 'Failed to fetch shop orders' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { orderId, status } = await req.json();

    const currentOrder = await prisma.order.findUnique({
      where: { id: orderId }
    });

    if (!currentOrder) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: { status },
    });

    // If shop owner marks order DELIVERED, update rider's completed count properly if rider assigned
    if (status === "DELIVERED" && currentOrder.status !== "DELIVERED" && currentOrder.riderId) {
      const actualDelivered = await prisma.order.count({
        where: { riderId: currentOrder.riderId, status: "DELIVERED" }
      });
      await prisma.user.update({
        where: { id: currentOrder.riderId },
        data: { completedDeliveries: actualDelivered }
      });
    }

    return NextResponse.json({ success: true, status: updated.status });
  } catch (error) {
    console.error("Update shop order error:", error);
    return NextResponse.json({ error: 'Failed to update order' }, { status: 500 });
  }
}
