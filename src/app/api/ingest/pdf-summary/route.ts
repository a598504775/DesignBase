import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

type PdfSummaryBody = {
  assetId: string;
};

function getSupabaseServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing Supabase server environment variables.");
  }

  return createClient(supabaseUrl, supabaseKey);
}

function cleanText(text: string | null | undefined): string {
  if (!text) return "";
  return text.replace(/\s+/g, " ").trim();
}

function clip(text: string, maxLength: number) {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
}

function pickRepresentativePages(
  rows: Array<{ unit_index: number; extracted_text: string | null }>
) {
  const nonEmpty = rows
    .map((row) => ({
      unit_index: row.unit_index,
      text: cleanText(row.extracted_text),
    }))
    .filter((row) => row.text.length > 0);

  if (nonEmpty.length === 0) return [];

  const picked: Array<{ unit_index: number; text: string }> = [];

  // Get first two pages
  for (const row of nonEmpty.slice(0, 2)) {
    picked.push(row);
  }

  // Extract other pages in the rest of the file
  if (nonEmpty.length > 2) {
    const middleIndex = Math.floor(nonEmpty.length / 2);
    const lastIndex = nonEmpty.length - 1;

    const candidates = [middleIndex, lastIndex];

    for (const idx of candidates) {
      const row = nonEmpty[idx];
      if (
        row &&
        !picked.some((p) => p.unit_index === row.unit_index)
      ) {
        picked.push(row);
      }
    }
  }

  return picked;
}

function stripCodeFence(raw: string) {
  return raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
}

export async function POST(req: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing OPENAI_API_KEY in server environment." },
        { status: 500 }
      );
    }

    const { assetId } = (await req.json()) as PdfSummaryBody;

    if (!assetId) {
      return NextResponse.json(
        { error: "Missing assetId." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServerClient();

    const { data: assetRow, error: assetError } = await supabase
      .from("assets")
      .select("id, file_name, asset_type")
      .eq("id", assetId)
      .single();

    if (assetError) throw assetError;
    if (!assetRow) {
      return NextResponse.json(
        { error: "Asset not found." },
        { status: 404 }
      );
    }

    if (assetRow.asset_type !== "PDF") {
      return NextResponse.json(
        { error: "Asset is not a PDF." },
        { status: 400 }
      );
    }

    const { data: pageRows, error: pageError } = await supabase
      .from("asset_content_units")
      .select("unit_index, extracted_text")
      .eq("asset_id", assetId)
      .eq("unit_type", "document_page")
      .order("unit_index", { ascending: true });

    if (pageError) throw pageError;

    const pages = pageRows ?? [];
    if (pages.length === 0) {
      return NextResponse.json(
        { error: "No page-level content units found for this PDF." },
        { status: 409 }
      );
    }

    const sampledPages = pickRepresentativePages(pages);

    const contextBlocks = sampledPages.map((page) => {
      return `Page ${page.unit_index}: ${clip(page.text, 1200)}`;
    });

    const client = new OpenAI({ apiKey });

    const prompt = `
You are analyzing an architectural project file (PDF or image).

Your task is to produce a high-quality semantic summary for search and retrieval.

First, identify the TYPE and PURPOSE of the document (e.g. construction documents, presentation deck, concept design, technical detail package, report, etc).

Then, describe the main CONTENTS and DISCIPLINES involved.

Focus on what makes this document DISTINCT from other architectural files.

Avoid repeating generic terms unless necessary.

Output format:

1. One concise sentence describing what this document is (type + purpose + stage if possible)

2. A list of key elements and contents (comma-separated keywords)

Avoid generic phrases like "design package" or "project documentation" unless they are truly necessary.
Be specific and architectural.

Return strict JSON:
{
  "summary": "one concise asset-level summary sentence",
  "keywords": ["5 to 8 short keyword phrases"]
}
    `.trim();

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: [
                prompt,
                "",
                `File name: ${assetRow.file_name ?? "Unknown file"}`,
                `Total pages: ${pages.length}`,
                "",
                "Representative text samples:",
                ...contextBlocks,

              ].join("\n"),
            },
          ],
        },
      ],
    });

    const raw = response.choices[0]?.message?.content ?? "";
    const cleaned = stripCodeFence(raw);

    let parsed: {
      summary?: string;
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

    const summaryText = [
      parsed.summary ?? null,
      ...(parsed.keywords ?? []),
    ]
      .filter(Boolean)
      .join(". ");

    const { error: updateError } = await supabase
      .from("assets")
      .update({
        ai_summary: summaryText || null,
      })
      .eq("id", assetId);

    if (updateError) throw updateError;

    return NextResponse.json({
      ok: true,
      assetId,
      totalPages: pages.length,
      sampledPages: sampledPages.map((p) => p.unit_index),
      summary: parsed.summary ?? null,
      keywords: parsed.keywords ?? [],
      aiSummary: summaryText || null,
    });
  } catch (e: any) {
    console.error("PDF asset summary failed:", e);
    return NextResponse.json(
      { error: e?.message ?? "Unknown server error." },
      { status: 500 }
    );
  }
}