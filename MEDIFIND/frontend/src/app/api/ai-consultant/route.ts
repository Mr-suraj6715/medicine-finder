import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(req: Request) {
    try {
        const { message, email } = await req.json();

        if (!message) {
            return NextResponse.json({ error: "Message is required" }, { status: 400 });
        }

        // 1. Call Groq for Conversational AI Reply
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
            },
            body: JSON.stringify({
                model: "llama-3.3-70b-versatile",
                messages: [
                    {
                        role: "system",
                        content: "You are an AI medical assistant for MediFind. Help users understand their symptoms and suggest common over-the-counter medicines. Always advise consulting a doctor for serious conditions. Keep your response concise (max 3-4 sentences).",
                    },
                    {
                        role: "user",
                        content: message,
                    },
                ],
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Groq API Error:", errorText);
            return NextResponse.json({
                reply: "AI service is temporarily unavailable. Please try again later.",
                prescription: [],
                message: "Service Error"
            });
        }

        console.log("Groq Status:", response.status);

        const data = await response.json();
        console.log("Groq Response:", JSON.stringify(data, null, 2));

        const aiReply =
            data?.choices?.[0]?.message?.content ||
            "I'm sorry, I couldn't generate a response.";
        // 2. AI Match Logic: Search medicines that have these symptoms in their indications
        const symptomList = message.toLowerCase().split(/[ ,]+/).map((s: string) => s.trim()).filter((s: string) => s.length > 2);

        const allMedicines = await prisma.medicine.findMany({
            include: {
                inventory: {
                    include: {
                        pharmacy: true
                    }
                }
            }
        });
        const matches = allMedicines.filter(med => {
            if (!med.indications) return false;
            const indications = med.indications.toLowerCase();
            return symptomList.some(symptom => indications.includes(symptom));
        }).slice(0, 3); // Return top 3 matches

        // 3. Save Health Log if email is provided
        if (email) {
            const user = await prisma.user.findUnique({ where: { email } });
            if (user) {
                await prisma.healthLog.create({
                    data: {
                        userId: user.id,
                        symptoms: message,
                        prescription: matches.map(m => m.name).join(', '),
                    },
                });
            }
        }

        return NextResponse.json({
            reply: aiReply,
            prescription: matches,
            message: matches.length > 0
                ? `Based on your symptoms, we found matches in our database.`
                : `We couldn't find exact medicine matches in our database, but here is what the AI suggests.`
        });
    } catch (error) {
        console.error("AI Consultant Error:", error);
        return NextResponse.json({
            reply: "AI assistant is currently unavailable.",
            prescription: [],
            message: "System Error"
        });
    }
}