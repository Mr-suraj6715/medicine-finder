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
          { status: "CONFIRMED", riderId: null }, // Available orders (Ready for Pickup / Reassignment)
          { riderId: riderId } // Rider's own assigned orders
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
        cancelledRiderId: o.cancelledRiderId,
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

    // Fetch rider stats with exact delivered count from DB as source of truth
    const rider = await prisma.user.findUnique({
      where: { id: riderId }
    });

    let completedCount = rider?.completedDeliveries || 0;
    if (rider) {
      // Source of truth verification: count actual DELIVERED orders in DB for this rider
      const actualDelivered = await prisma.order.count({
        where: { riderId: riderId, status: "DELIVERED" }
      });
      if (actualDelivered !== rider.completedDeliveries) {
        completedCount = actualDelivered;
        // Sync user model with DB truth
        await prisma.user.update({
          where: { id: riderId },
          data: { completedDeliveries: actualDelivered }
        });
      }
    }

    return NextResponse.json({ 
      orders: mappedOrders,
      riderStats: rider ? {
        rating: rider.riderRating,
        loyaltyPoints: rider.riderLoyaltyPoints,
        completedDeliveries: completedCount,
        cancelledDeliveries: rider.cancelledDeliveries,
        name: rider.name,
        email: rider.email,
        phone: rider.phone || "",
        address: rider.address || "",
        vehicleType: rider.vehicleType || "Motorcycle",
      } : null
    });
  } catch (error) {
    console.error("GET rider orders error:", error);
    return NextResponse.json({ error: 'Failed to fetch rider orders' }, { status: 500 });
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

    const effectiveRiderId = riderId || order.riderId;
    if (!effectiveRiderId) {
      return NextResponse.json({ error: "No rider associated with this order" }, { status: 400 });
    }

    // Preventive check: prevent updating status if order was already delivered
    const previousStatus = order.status;
    if (previousStatus === "DELIVERED" && status === "DELIVERED") {
      return NextResponse.json({ success: true, status: "DELIVERED", message: "Order was already marked delivered" });
    }

    let additionalData: any = {};
    if (status === "RIDER_PICKED_UP") {
      additionalData.deliveryStartTime = new Date();
    }

    // Handling RIDER CANCELLATION:
    // If rider cancels, do NOT delete order! Mark rider assignment cancelled, set riderId=null, status="CONFIRMED" so it can be reassigned!
    if (status === "CANCELLED") {
      const activeRiderId = order.riderId || effectiveRiderId;
      
      // Update order to unassign rider and keep order active for reassignment
      const updated = await prisma.order.update({
        where: { id: orderId },
        data: {
          status: "CONFIRMED", // Return order to available pool for reassignment
          riderId: null,
          cancelledRiderId: activeRiderId,
        },
      });

      // Update rider performance stats for cancellation
      if (activeRiderId) {
        const rider = await prisma.user.findUnique({ where: { id: activeRiderId } });
        if (rider) {
          const newRating = Math.max(0, Math.min(5, rider.riderRating - 0.2));
          const newPoints = Math.max(0, rider.riderLoyaltyPoints - 10);
          await prisma.user.update({
            where: { id: activeRiderId },
            data: {
              riderRating: newRating,
              riderLoyaltyPoints: newPoints,
              cancelledDeliveries: { increment: 1 }
            }
          });
        }
      }

      return NextResponse.json({ success: true, status: updated.status, message: "Order cancelled by rider and returned to available pool for reassignment" });
    }

    // Normal status update
    const updated = await prisma.order.update({
      where: { id: orderId },
      data: { status, riderId: effectiveRiderId, ...additionalData },
    });

    // Update Rider Loyalty and Rating when status changes to DELIVERED or FAILED
    if (effectiveRiderId && (status === "DELIVERED" || status === "FAILED")) {
      let ratingAdj = 0;
      let pointsAdj = 0;

      // Performance data for the order
      let orderRatingEarned = 0;
      let orderPointsChange = 0;
      let durationMinutes = 0;
      const endTime = new Date();

      if (status === "DELIVERED" && previousStatus !== "DELIVERED") {
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
        
        ratingAdj = (orderRatingEarned - 3) * 0.1 || 0.1;
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

        // Compute exact source-of-truth completed deliveries count
        const actualDelivered = await prisma.order.count({
          where: { riderId: effectiveRiderId, status: "DELIVERED" }
        });

        const currentRider = await prisma.user.findUnique({ where: { id: effectiveRiderId } });
        const currentRating = currentRider?.riderRating || 3.0;
        const currentPoints = currentRider?.riderLoyaltyPoints || 0;
        const newRating = Math.max(0, Math.min(5, currentRating + ratingAdj));
        const newPoints = Math.max(0, currentPoints + pointsAdj);

        await prisma.user.update({
          where: { id: effectiveRiderId },
          data: {
            riderRating: newRating,
            riderLoyaltyPoints: newPoints,
            completedDeliveries: actualDelivered
          }
        });
      } else if (status === "FAILED") {
        ratingAdj = -0.3;
        pointsAdj = -15;

        const currentRider = await prisma.user.findUnique({ where: { id: effectiveRiderId } });
        const currentRating = currentRider?.riderRating || 3.0;
        const currentPoints = currentRider?.riderLoyaltyPoints || 0;
        const newRating = Math.max(0, Math.min(5, currentRating + ratingAdj));
        const newPoints = Math.max(0, currentPoints + pointsAdj);

        await prisma.user.update({
          where: { id: effectiveRiderId },
          data: {
            riderRating: newRating,
            riderLoyaltyPoints: newPoints,
          }
        });
      }
    }

    return NextResponse.json({ success: true, status: updated.status });
  } catch (error) {
    console.error("Status update error:", error);
    return NextResponse.json({ error: 'Failed to update order status' }, { status: 500 });
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

    if (!rider || !order) return NextResponse.json({ error: "Rider or Order not found" }, { status: 404 });

    // Calculate Driver Earnings based on rating
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
    return NextResponse.json({ error: 'Failed to accept order' }, { status: 500 });
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
