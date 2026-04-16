import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
export const runtime = "nodejs";

type DocxSummaryBody = {
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

function stripCodeFence(raw: string) {
  return raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
}

function pickRepresentativeBlocks(
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

  // first 2
  for (const row of nonEmpty.slice(0, 2)) {
    picked.push(row);
  }

  // middle + last
  if (nonEmpty.length > 2) {
    const middleIndex = Math.floor(nonEmpty.length / 2);
    const lastIndex = nonEmpty.length - 1;

    for (const idx of [middleIndex, lastIndex]) {
      const row = nonEmpty[idx];
      if (row && !picked.some((p) => p.unit_index === row.unit_index)) {
        picked.push(row);
      }
    }
  }

  return picked;
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

    const { assetId } = (await req.json()) as DocxSummaryBody;

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

    const fileName = assetRow.file_name?.toLowerCase() ?? "";
    if (!fileName.endsWith(".docx")) {
        return NextResponse.json(
            { error: "Asset is not a DOCX file." },
            { status: 400 }
        );
    }    

    const { data: blockRows, error: blockError } = await supabase
      .from("asset_content_units")
      .select("unit_index, extracted_text")
      .eq("asset_id", assetId)
      .eq("unit_type", "text_block")
      .eq("source_format", "docx")
      .order("unit_index", { ascending: true });

    if (blockError) throw blockError;

    const blocks = blockRows ?? [];
    if (blocks.length === 0) {
      return NextResponse.json(
        { error: "No DOCX text blocks found for this asset." },
        { status: 409 }
      );
    }

    const sampledBlocks = pickRepresentativeBlocks(blocks);

    const contextBlocks = sampledBlocks.map((block) => {
      return `Block ${block.unit_index}: ${clip(block.text, 1200)}`;
    });

    const client = new OpenAI({ apiKey });

    const prompt = `
You are analyzing an architectural or design document file.

Your task is to produce a high-quality semantic summary for search and retrieval.

First, identify the TYPE and PURPOSE of the document
(e.g. design narrative, report, specification excerpt, project brief, meeting notes, concept package, feasibility study).

Then, describe the main CONTENTS and DISCIPLINES involved.

Focus on what makes this document distinct from other architectural files.
Prefer document type, stage, and dominant content categories over generic labels.

Avoid generic phrases like "document" or "project file" unless they are truly necessary.
Be specific and architectural.
Do not overemphasize one local paragraph unless it clearly represents most of the file.

Keywords should be short architectural retrieval phrases, not full sentences.

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
                `Total blocks: ${blocks.length}`,
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
      totalBlocks: blocks.length,
      sampledBlocks: sampledBlocks.map((b) => b.unit_index),
      summary: parsed.summary ?? null,
      keywords: parsed.keywords ?? [],
      aiSummary: summaryText || null,
    });
  } catch (e: any) {
    console.error("DOCX asset summary failed:", e);
    return NextResponse.json(
      { error: e?.message ?? "Unknown server error." },
      { status: 500 }
    );
  }
}