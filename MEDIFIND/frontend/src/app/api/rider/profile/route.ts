import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId');
  if (!userId) {
    return NextResponse.json({ error: 'User ID required' }, { status: 400 });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone || "",
        address: user.address || "",
        vehicleType: user.vehicleType || "Motorcycle",
        riderRating: user.riderRating,
        riderLoyaltyPoints: user.riderLoyaltyPoints,
        completedDeliveries: user.completedDeliveries,
        cancelledDeliveries: user.cancelledDeliveries,
        role: user.role,
      }
    });
  } catch (error) {
    console.error("Fetch profile error:", error);
    return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { userId, name, phone, address, vehicleType } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    // Input validation
    if (name !== undefined && (!name || name.trim().length < 2)) {
      return NextResponse.json({ error: 'Name must be at least 2 characters long' }, { status: 400 });
    }

    if (phone !== undefined && phone.trim() !== "") {
      const phoneRegex = /^[0-9+\-\s()]{7,15}$/;
      if (!phoneRegex.test(phone.trim())) {
        return NextResponse.json({ error: 'Invalid phone number format' }, { status: 400 });
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(phone !== undefined && { phone: phone.trim() }),
        ...(address !== undefined && { address: address.trim() }),
        ...(vehicleType !== undefined && { vehicleType: vehicleType.trim() }),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        phone: updatedUser.phone || "",
        address: updatedUser.address || "",
        vehicleType: updatedUser.vehicleType || "Motorcycle",
        riderRating: updatedUser.riderRating,
        riderLoyaltyPoints: updatedUser.riderLoyaltyPoints,
        completedDeliveries: updatedUser.completedDeliveries,
        cancelledDeliveries: updatedUser.cancelledDeliveries,
        role: updatedUser.role,
      }
    });
  } catch (error) {
    console.error("Update profile error:", error);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}
