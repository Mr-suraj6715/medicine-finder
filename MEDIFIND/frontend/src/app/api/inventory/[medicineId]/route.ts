import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = 'force-dynamic';

export async function GET(
  req: Request,
  context: { params: Promise<{ medicineId: string }> }
) {
  const { medicineId } = await context.params;

  try {
    const inventory = await prisma.inventory.findMany({
      where: { medicineId },
      include: { pharmacy: true },
    });

    return NextResponse.json({ inventory });
  } catch (error) {
    console.error("Inventory API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch inventory" },
      { status: 500 }
    );
  }
}