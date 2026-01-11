import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get("file") as File;

        if (!file) {
            return NextResponse.json({ error: "No file provided" }, { status: 400 });
        }

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        const base64Image = buffer.toString("base64");

        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        const prompt = `
      Analyze this workout summary screen image and extract the following data into a JSON format.
      If a field is not found, use null.
      
      Fields to extract:
      - workout_type: One of ['running', 'swimming', 'cycling', 'treadmill', 'hiking']. Infer from context if needed.
      - workout_date: Date of workout in YYYY-MM-DD format.
      - duration: Total duration string (e.g. "1:30:00" or "45:00").
      - distance: Distance value (number only).
      - distance_unit: Unit of distance ('km', 'm', 'mi').
      - avg_heart_rate: Average heart rate (number).
      - cadence: Average cadence/spm (number).
      - swolf: Swolf score (number, for swimming).

      Return ONLY the JSON object, no markdown formatting.
    `;

        const result = await model.generateContent([
            prompt,
            {
                inlineData: {
                    data: base64Image,
                    mimeType: file.type,
                },
            },
        ]);

        const response = await result.response;
        const text = response.text();

        // Clean up potential markdown code blocks
        const cleanedText = text.replace(/```json/g, "").replace(/```/g, "").trim();
        const data = JSON.parse(cleanedText);

        return NextResponse.json(data);
    } catch (error: any) {
        console.error("Error analyzing image:", error);

        // Check for Quota/Rate Limit errors
        const status = error.status || 500;
        const message = error.message || "Failed to analyze image";

        if (message.includes("429") || message.includes("Quota") || status === 429) {
            return NextResponse.json(
                { error: "API usage limit exceeded. Please try again in 30 seconds." },
                { status: 429 }
            );
        }

        return NextResponse.json(
            { error: message },
            { status: status }
        );
    }
}
