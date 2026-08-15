import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const riders = await prisma.user.findMany({
      where: { role: 'rider' },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        vehicleType: true,
        riderRating: true,
        completedDeliveries: true,
        cancelledDeliveries: true,
        latitude: true,
        longitude: true,
      }
    });

    return NextResponse.json({ riders });
  } catch (error) {
    console.error("Get riders error:", error);
    return NextResponse.json({ error: 'Failed to fetch riders' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { orderId, riderId } = await req.json();

    if (!orderId || !riderId) {
      return NextResponse.json({ error: 'orderId and riderId required' }, { status: 400 });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId }
    });

    const newRider = await prisma.user.findUnique({
      where: { id: riderId }
    });

    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    if (!newRider) return NextResponse.json({ error: 'Rider not found' }, { status: 404 });

    // Calculate Driver Earnings based on rating
    let earningsFactor = 0;
    if (newRider.riderRating >= 4) earningsFactor = 1;
    else if (newRider.riderRating >= 3) earningsFactor = 0.5;
    else earningsFactor = 0;

    const finalDriverEarnings = order.isEmergency ? (order.surgeFee * earningsFactor) : 0;

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: {
        riderId: riderId,
        status: 'RIDER_ASSIGNED',
        driverEarnings: finalDriverEarnings,
      },
      include: {
        rider: true,
        user: true,
      }
    });

    return NextResponse.json({
      success: true,
      message: `Order successfully assigned to ${newRider.name || newRider.email}`,
      order: updated,
    });
  } catch (error) {
    console.error("Reassign error:", error);
    return NextResponse.json({ error: 'Failed to reassign order' }, { status: 500 });
  }
}
