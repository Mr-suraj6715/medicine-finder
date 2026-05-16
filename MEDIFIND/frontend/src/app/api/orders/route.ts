import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// GET: Get orders for a user (by email)
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const email = searchParams.get('email');
  if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 });

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return NextResponse.json({ orders: [] });

    const orders = await prisma.order.findMany({
      where: { userId: user.id },
      include: {
        items: {
          include: {
            inventory: {
              include: { medicine: true, pharmacy: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ orders });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, items, isEmergency, paymentMethod, deliveryAddress, deliveryLat, deliveryLng } = body;

    const user = await prisma.user.findUnique({
      where: { email: email || 'user@example.com' },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const inventoryIds = items.map((item: any) => item.inventoryId);
    const inventories = await prisma.inventory.findMany({
      where: { id: { in: inventoryIds } },
      include: { pharmacy: true },
    });

    let subtotal = 0;
    let totalItems = 0;
    let maxDistance = 0;

    const orderItemsData = items.map((item: any) => {
      const inv = inventories.find((i) => i.id === item.inventoryId);
      if (!inv) throw new Error(`Inventory ${item.inventoryId} not found`);
      subtotal += inv.price * item.quantity;
      totalItems += item.quantity;
      if (inv.pharmacy.distance > maxDistance) maxDistance = inv.pharmacy.distance;
      return { inventoryId: item.inventoryId, quantity: item.quantity, priceAtTime: inv.price };
    });

    // Surge Fee Logic
    let surgeFee = 0;
    if (isEmergency) {
      if (maxDistance <= 2) {
        surgeFee = 30;
      } else {
        surgeFee = 60; // ₹50–₹60, using 60
      }
    }
    const driverEarnings = surgeFee;

    const hasDiscount = totalItems > 5 && subtotal >= 100;
    const discountAmount = hasDiscount ? subtotal * 0.10 : 0;
    const finalTotal = subtotal - discountAmount;
    const loyaltyEarned = finalTotal >= 100 ? 1 : 0;
    const trackingNumber = `MF-${Math.random().toString(36).toUpperCase().substring(2, 10)}`;
    const estimatedDelivery = new Date();
    estimatedDelivery.setDate(estimatedDelivery.getDate() + 3);

    const order = await prisma.$transaction(async (tx) => {
      const newOrder = await tx.order.create({
        data: {
          userId: user.id,
          totalAmount: finalTotal + surgeFee,
          discountApplied: discountAmount,
          loyaltyEarned: loyaltyEarned,
          isEmergency: isEmergency || false,
          surgeFee: surgeFee,
          driverEarnings: driverEarnings,
          paymentMethod: paymentMethod || "CASH_ON_DELIVERY",
          deliveryAddress: deliveryAddress || null,
          deliveryLat: deliveryLat || null,
          deliveryLng: deliveryLng || null,
          deliveryDistance: maxDistance,
          items: { create: orderItemsData },
        },
      });

      // Update inventory stock and sold count
      for (const item of orderItemsData) {
        await tx.inventory.update({
          where: { id: item.inventoryId },
          data: {
            stock: { decrement: item.quantity },
            sold: { increment: item.quantity },
          },
        });
      }

      await tx.order.update({
        where: { id: newOrder.id },
        data: {
          status: "PENDING",
          trackingNumber: trackingNumber,
          estimatedDelivery: estimatedDelivery
        }
      });

      if (loyaltyEarned > 0) {
        await tx.user.update({
          where: { id: user.id },
          data: { loyaltyPoints: { increment: loyaltyEarned } },
        });
      }

      return { ...newOrder, status: "PENDING", trackingNumber, estimatedDelivery };
    });

    return NextResponse.json({ order, message: hasDiscount ? "Bulk discount applied!" : undefined });
  } catch (error: any) {
    console.error('Order creation error:', error);
    return NextResponse.json({ error: error.message || 'Failed to create order' }, { status: 500 });
  }
}
