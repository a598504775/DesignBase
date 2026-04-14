import { NextResponse } from "next/server";
import { extractText, getDocumentProxy } from "unpdf";
import { createClient } from "@supabase/supabase-js";

type IngestPdfBody = {
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

// Review this
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as IngestPdfBody;
    const { assetId, projectId, storagePath } = body;

    if (!assetId || !projectId || !storagePath) {
      return NextResponse.json(
        { error: "assetId, projectId, and storagePath are required." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServerClient();
    console.log(`Rebuilding content units for asset ${assetId}`);

    // 1) Download PDF from Storage
    const downloadRes = await supabase.storage
      .from("designbase-assets")
      .download(storagePath);

    if (downloadRes.error || !downloadRes.data) {
      throw downloadRes.error ?? new Error("Failed to download PDF from storage.");
    }

    const arrayBuffer = await downloadRes.data.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuffer);

    // 2) Parse PDF and extract page-level text
    const pdf = await getDocumentProxy(uint8);
    const { totalPages, text } = await extractText(pdf, { mergePages: false });

    // text should be string[], one entry per page
    if (!Array.isArray(text)) {
      throw new Error("Expected page-level text array from PDF extractor.");
    }

    // 3) Clear old document_page rows for this asset (idempotent rebuild)
    const deleteRes = await supabase
      .from("asset_content_units")
      .delete()
      .eq("asset_id", assetId)
      .eq("unit_type", "document_page");

    if (deleteRes.error) {
      throw deleteRes.error;
    }

    // 4) Insert fresh page rows
    const rows = text.map((pageText, index) => ({
      asset_id: assetId,
      project_id: projectId,
      unit_index: index + 1,
      unit_type: "document_page",
      source_format: "pdf",
      extracted_text: pageText || null,
      generated_text: null,
      preview_url: null,
      display_label: `Page ${index + 1}`,
      display_title: null,
      text_kind: "native_text",
      content_kind: "text_heavy",
      meta: {
        total_pages: totalPages,
      },
    }));

    if (rows.length > 0) {
      const insertRes = await supabase
        .from("asset_content_units")
        .insert(rows);

      if (insertRes.error) {
        throw insertRes.error;
      }
    }

    return NextResponse.json({
      ok: true,
      assetId,
      projectId,
      totalPages,
      inserted: rows.length,
    });
  } catch (error: any) {
    console.error("PDF ingestion failed:", error);

    return NextResponse.json(
      {
        ok: false,
        error: error?.message ?? "PDF ingestion failed.",
      },
      { status: 500 }
    );
  }
}