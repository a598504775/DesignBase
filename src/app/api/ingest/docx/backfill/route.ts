import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabaseServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing Supabase server environment variables.");
  }

  return createClient(supabaseUrl, supabaseKey);
}

export const runtime = "nodejs";

export async function POST() {
  try {
    const supabase = getSupabaseServerClient();

    const { data: docxAssets, error } = await supabase
      .from("assets")
      .select("id, project_id, storage_path, file_name")
      .ilike("file_name", "%.docx")
      .not("storage_path", "is", null);

    if (error) throw error;

    const assets = docxAssets ?? [];
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

    const results: Array<{
      assetId: string;
      ok: boolean;
      error?: string;
    }> = [];

    for (const asset of assets) {
      try {
        const ingestRes = await fetch(`${baseUrl}/api/ingest/docx`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            assetId: asset.id,
            projectId: asset.project_id,
            storagePath: asset.storage_path,
          }),
        });

        if (!ingestRes.ok) {
          const payload = await ingestRes.json().catch(() => null);
          results.push({
            assetId: asset.id,
            ok: false,
            error: payload?.error ?? "DOCX ingestion failed",
          });
          continue;
        }

        const summaryRes = await fetch(`${baseUrl}/api/ingest/docx-summary`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            assetId: asset.id,
          }),
        });

        if (!summaryRes.ok) {
          const payload = await summaryRes.json().catch(() => null);
          results.push({
            assetId: asset.id,
            ok: false,
            error: payload?.error ?? "DOCX summary failed",
          });
          continue;
        }

        results.push({
          assetId: asset.id,
          ok: true,
        });
      } catch (err: any) {
        results.push({
          assetId: asset.id,
          ok: false,
          error: err?.message ?? "Unexpected error",
        });
      }
    }

    const successCount = results.filter((x) => x.ok).length;
    const failCount = results.length - successCount;

    return NextResponse.json({
      ok: true,
      total: results.length,
      successCount,
      failCount,
      results,
    });
  } catch (error: any) {
    console.error("DOCX backfill failed:", error);

    return NextResponse.json(
      {
        ok: false,
        error: error?.message ?? "DOCX backfill failed.",
      },
      { status: 500 }
    );
  }
}