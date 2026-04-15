import { NextResponse } from "next/server";
import OpenAI from "openai";

export async function POST(req: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing OPENAI_API_KEY in server environment." },
        { status: 500 }
      );
    }

    const client = new OpenAI({ apiKey });

    const { imageUrl } = await req.json();

    if (!imageUrl) {
      return NextResponse.json({ error: "Missing imageUrl" }, { status: 400 });
    }

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `
You are generating searchable metadata for an architecture and design image library.

The image may be one of many different types, including but not limited to:
- architectural rendering
- interior rendering
- urban design / masterplan rendering
- built project photo
- site photo
- diagram
- site analysis
- circulation / sun / massing / organization diagram
- floor plan
- section
- elevation
- detail drawing
- technical drawing

Your job is to identify the most likely image type and produce concise, useful search metadata.

Rules:
- Focus on what is visually clear and useful for retrieval.
- Do not guess project name, location, architect, or program unless clearly visible in the image.
- If uncertain, stay generic rather than inventing specifics.
- Prefer concrete visual/spatial terms over vague words.
- If the image is a diagram or drawing, describe the diagram/drawing type and what it communicates.
- If the image is a rendering or photo, describe form, materials, color, scale, lighting/time-of-day if visible, and key spatial qualities.

Return strict JSON with this shape:
{
  "image_type": "one short label",
  "caption": "one concise sentence for search",
  "keywords": ["5 to 8 short keyword phrases"]
}
              `.trim(),
            },
            {
              type: "image_url",
              image_url: { url: imageUrl },
            },
          ],
        },
      ],
    });

    const raw = response.choices[0]?.message?.content ?? "";

    const cleaned = raw
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/, "")
      .trim();

    let parsed: {
      image_type?: string;
      caption?: string;
      keywords?: string[];
    } = {};

    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return NextResponse.json(
        {
          error: "Model did not return valid JSON.",
          raw,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      imageType: parsed.image_type ?? null,
      caption: parsed.caption ?? null,
      keywords: parsed.keywords ?? [],
    });
  } catch (e: any) {
    console.error("Image ingest route failed:", e);
    return NextResponse.json(
      { error: e?.message ?? "Unknown server error" },
      { status: 500 }
    );
  }
}