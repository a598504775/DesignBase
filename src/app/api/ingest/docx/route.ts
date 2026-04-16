import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import mammoth from "mammoth";
import { createDocxTextBlockContentUnits } from "@/lib/contentUnits";
import { ASSET_BUCKET } from "@/lib/assets";
export const runtime = "nodejs";

type DocxIngestBody = {
  assetId: string;
  projectId: string;
  storagePath: string;
};

function getSupabaseServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing Supabase server environment variables.");
  }

  return createClient(supabaseUrl, supabaseKey);
}

function normalizeParagraphs(text: string) {
  return text
    .split(/\n\s*\n/g)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function chunkParagraphs(
  paragraphs: string[],
  maxChars = 1800,
  minChars = 600
) {
  const blocks: string[] = [];
  let current = "";

  for (const paragraph of paragraphs) {
    const candidate = current ? `${current}\n\n${paragraph}` : paragraph;

    if (candidate.length <= maxChars) {
      current = candidate;
      continue;
    }

    if (current.length >= minChars) {
      blocks.push(current);
      current = paragraph;
    } else {
      current = candidate;
    }
  }

  if (current.trim()) {
    blocks.push(current.trim());
  }

  return blocks;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as DocxIngestBody;
    const { assetId, projectId, storagePath } = body;

    if (!assetId || !projectId || !storagePath) {
      return NextResponse.json(
        { error: "Missing assetId, projectId, or storagePath." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServerClient();

    const { data: assetRow, error: assetError } = await supabase
      .from("assets")
      .select("id, file_name, asset_type, project_id")
      .eq("id", assetId)
      .single();

    if (assetError) throw assetError;
    if (!assetRow) {
      return NextResponse.json({ error: "Asset not found." }, { status: 404 });
    }
    
    const fileName = assetRow.file_name?.toLowerCase() ?? "";
    if (!fileName.endsWith(".docx")) {
      return NextResponse.json(
        { error: "Asset is not a DOCX file." },
        { status: 400 }
      );
    }    

    const { data: fileData, error: downloadError } = await supabase.storage
      .from(ASSET_BUCKET)
      .download(storagePath);

    if (downloadError) throw downloadError;

    const arrayBuffer = await fileData.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const result = await mammoth.extractRawText({ buffer });
    const rawText = result.value?.trim() ?? "";

    if (!rawText) {
      return NextResponse.json(
        { error: "No text extracted from DOCX." },
        { status: 409 }
      );
    }

    const paragraphs = normalizeParagraphs(rawText);
    const blocks = chunkParagraphs(paragraphs);

    await createDocxTextBlockContentUnits({
      supabase,
      asset: assetRow,
      blocks,
    });

    return NextResponse.json({
      ok: true,
      assetId,
      blockCount: blocks.length,
      extractedChars: rawText.length,
    });
  } catch (e: any) {
    console.error("DOCX ingestion failed:", e);
    return NextResponse.json(
      { error: e?.message ?? "Unknown server error." },
      { status: 500 }
    );
  }
}