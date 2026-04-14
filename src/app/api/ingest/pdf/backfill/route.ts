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

export async function POST() {
  try {
    const supabase = getSupabaseServerClient();

    const { data: pdfAssets, error } = await supabase
      .from("assets")
      .select("id, project_id, storage_path, asset_type")
      .eq("asset_type", "PDF")
      .not("storage_path", "is", null);

    if (error) {
      throw error;
    }

    const assets = pdfAssets ?? [];
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

    const results: Array<{
      assetId: string;
      ok: boolean;
      error?: string;
    }> = [];

    for (const asset of assets) {
      try {
        const res = await fetch(`${baseUrl}/api/ingest/pdf`, {
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

        if (!res.ok) {
          const payload = await res.json().catch(() => null);
          results.push({
            assetId: asset.id,
            ok: false,
            error: payload?.error ?? "Ingestion failed",
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
    console.error("PDF backfill failed:", error);

    return NextResponse.json(
      {
        ok: false,
        error: error?.message ?? "PDF backfill failed.",
      },
      { status: 500 }
    );
  }
}