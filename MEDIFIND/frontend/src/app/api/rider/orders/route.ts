import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const riderId = searchParams.get('riderId');
  if (!riderId) return NextResponse.json({ error: 'Rider ID required' }, { status: 400 });

  try {
    const orders = await prisma.order.findMany({
      where: {
        OR: [
          { status: "CONFIRMED", riderId: null }, // Available orders (Ready for Pickup)
          { riderId: riderId } // Rider's own orders
        ]
      },
      include: {
        user: true,
        items: {
          include: {
            inventory: {
              include: {
                medicine: true,
                pharmacy: true
              }
            }
          }
        }
      },
      orderBy: [
        { isEmergency: 'desc' }, // Emergency orders first
        { createdAt: 'desc' }
      ]
    });

    const mappedOrders = orders.map(o => {
      // Find pharmacy info from the first item
      const pharmacy = o.items[0]?.inventory.pharmacy;
      return {
        id: o.trackingNumber || o.id,
        realId: o.id,
        customer: o.user.name || o.user.email,
        customerAddress: o.deliveryAddress || "Mumbai, MH",
        customerCoord: { lat: o.deliveryLat || 19.082, lng: o.deliveryLng || 72.881 },
        total: o.totalAmount,
        status: o.status,
        isEmergency: o.isEmergency,
        surgeFee: o.surgeFee,
        riderId: o.riderId,
        pharmacyName: pharmacy?.name,
        pharmacyAddress: pharmacy?.location,
        pharmacyCoord: { lat: pharmacy?.latitude || 19.076, lng: pharmacy?.longitude || 72.877 },
        distance: pharmacy?.distance,
        items: o.items.map((i: any) => ({ 
          name: i.inventory.medicine.name, 
          qty: i.quantity,
          price: i.priceAtTime
        })),
        time: new Date(o.createdAt).toLocaleString(),
        deliveryStartTime: o.deliveryStartTime,
        deliveryEndTime: o.deliveryEndTime,
        deliveryDuration: o.deliveryDurationMinutes,
        deliveryDistance: o.deliveryDistance,
        ratingEarned: o.ratingEarned,
        pointsChange: o.loyaltyPointsChange
      };
    });

    // Fetch rider stats if ID is provided
    const rider = await prisma.user.findUnique({
      where: { id: riderId }
    });

    return NextResponse.json({ 
      orders: mappedOrders,
      riderStats: rider ? {
        rating: rider.riderRating,
        loyaltyPoints: rider.riderLoyaltyPoints,
        completedDeliveries: rider.completedDeliveries,
        cancelledDeliveries: rider.cancelledDeliveries
      } : null
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { orderId, status, riderId } = await req.json();
    
    // Fetch current order and rider to update stats
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { rider: true }
    });

    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    // Update start time if picked up
    let additionalData: any = {};
    if (status === "RIDER_PICKED_UP") {
      additionalData.deliveryStartTime = new Date();
    }

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: { status, riderId, ...additionalData },
    });

    // Update Rider Loyalty and Rating if status is final
    if (riderId && (status === "DELIVERED" || status === "CANCELLED" || status === "FAILED")) {
      let ratingAdj = 0;
      let pointsAdj = 0;
      let completedInc = 0;
      let cancelledInc = 0;

      // Performance data for the order
      let orderRatingEarned = 0;
      let orderPointsChange = 0;
      let durationMinutes = 0;
      const endTime = new Date();

      if (status === "DELIVERED") {
        completedInc = 1;
        
        // Calculate performance
        if (order.deliveryStartTime) {
          durationMinutes = Math.round((endTime.getTime() - new Date(order.deliveryStartTime).getTime()) / (1000 * 60));
          const distance = order.deliveryDistance || 1.0;
          const ratio = durationMinutes / distance;

          if (ratio <= 10) { orderRatingEarned = 5; orderPointsChange = 15; }
          else if (ratio <= 15) { orderRatingEarned = 4; orderPointsChange = 10; }
          else if (ratio <= 20) { orderRatingEarned = 3; orderPointsChange = 5; }
          else if (ratio <= 25) { orderRatingEarned = 2; orderPointsChange = -5; }
          else { orderRatingEarned = 1; orderPointsChange = -10; }
        } else {
          // Fallback if start time missed
          orderRatingEarned = 3;
          orderPointsChange = 5;
        }

        // Apply emergency bonus if applicable
        if (order.isEmergency) orderPointsChange += 10; 
        
        ratingAdj = (orderRatingEarned - 3) * 0.1 || 0.1; // Simple adjustment
        pointsAdj = orderPointsChange;

        // Update Order with performance stats
        await prisma.order.update({
          where: { id: orderId },
          data: {
            deliveryEndTime: endTime,
            deliveryDurationMinutes: durationMinutes,
            ratingEarned: orderRatingEarned,
            loyaltyPointsChange: orderPointsChange
          }
        });
      } else if (status === "CANCELLED") {
        ratingAdj = -0.2;
        pointsAdj = -10;
        cancelledInc = 1;
      } else if (status === "FAILED") {
        ratingAdj = -0.3;
        pointsAdj = -15;
      }

      const currentRating = order.rider?.riderRating || 3.0;
      const currentPoints = order.rider?.riderLoyaltyPoints || 0;
      
      const newRating = Math.max(0, Math.min(5, currentRating + ratingAdj));
      const newPoints = Math.max(0, currentPoints + pointsAdj);

      await prisma.user.update({
        where: { id: riderId },
        data: {
          riderRating: newRating,
          riderLoyaltyPoints: newPoints,
          completedDeliveries: { increment: completedInc },
          cancelledDeliveries: { increment: cancelledInc }
        }
      });
    }

    return NextResponse.json({ success: true, status: updated.status });
  } catch (error) {
    console.error("Status update error:", error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const { orderId, riderId } = await req.json();
    
    // Fetch rider to check rating for earnings calculation
    const rider = await prisma.user.findUnique({
      where: { id: riderId }
    });

    const order = await prisma.order.findUnique({
      where: { id: orderId }
    });

    if (!rider || !order) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Calculate Driver Earnings based on rating
    // Rules: rating >= 4 (full), 3-4 (50%), < 3 (0%)
    let earningsFactor = 0;
    if (rider.riderRating >= 4) earningsFactor = 1;
    else if (rider.riderRating >= 3) earningsFactor = 0.5;
    else earningsFactor = 0;

    const finalDriverEarnings = order.isEmergency ? (order.surgeFee * earningsFactor) : 0;

    // Rider accepts order: set riderId and change status to RIDER_ASSIGNED
    const updated = await prisma.order.update({
      where: { id: orderId },
      data: { 
        riderId: riderId,
        status: "RIDER_ASSIGNED",
        driverEarnings: finalDriverEarnings
      },
    });
    return NextResponse.json({ success: true, status: updated.status });
  } catch (error) {
    console.error("Accept order error:", error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
export async function PATCH(req: Request) {
  try {
    const { riderId, latitude, longitude } = await req.json();
    await prisma.user.update({
      where: { id: riderId },
      data: { latitude, longitude }
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update location' }, { status: 500 });
  }
}
