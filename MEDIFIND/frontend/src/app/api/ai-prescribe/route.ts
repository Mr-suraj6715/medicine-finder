import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const { email, symptoms } = await req.json();

    if (!email || !symptoms) {
      return NextResponse.json({ error: 'Email and symptoms are required' }, { status: 400 });
    }

    // Find User
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // AI Match Logic: Search medicines that have these symptoms in their indications
    const symptomList = symptoms.toLowerCase().split(',').map((s: string) => s.trim());
    
    // Simple matching: find medicines where indications contain any of the symptoms
    const allMedicines = await prisma.medicine.findMany();
    const matches = allMedicines.filter(med => {
      if (!med.indications) return false;
      const indications = med.indications.toLowerCase();
      return symptomList.some(symptom => indications.includes(symptom));
    });

    // Save Health Log
    const log = await prisma.healthLog.create({
      data: {
        userId: user.id,
        symptoms,
        prescription: matches.map(m => m.name).join(', '),
      },
    });

    return NextResponse.json({
      success: true,
      prescription: matches,
      log,
      message: matches.length > 0 
        ? `Based on your symptoms (${symptoms}), our AI recommends the following medicines.` 
        : `No direct matches found for "${symptoms}". Please consult a doctor.`
    });

  } catch (error) {
    console.error('AI Prescribe Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const logs = await prisma.healthLog.findMany({
      where: { user: { email } },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    return NextResponse.json({ logs });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
