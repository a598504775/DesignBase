import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { ASSET_BUCKET } from "@/lib/assets";

export const runtime = "nodejs";

function getSupabaseServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing Supabase server environment variables.");
  }

  return createClient(supabaseUrl, supabaseKey);
}

function stripExtension(fileName: string): string {
  const idx = fileName.lastIndexOf(".");
  if (idx <= 0) return fileName;
  return fileName.slice(0, idx);
}

function inferSourceFormat(fileName: string): string | null {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  return ext || null;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url: string, options: any, retries = 5) {
  for (let i = 0; i < retries; i++) {
    const res = await fetch(url, options);

    if (res.ok) return res;

    if (res.status === 429) {
      const retryAfterMsHeader = res.headers.get("retry-after-ms");
      const retryAfterHeader = res.headers.get("retry-after");

      let waitMs = 3000;

      if (retryAfterMsHeader) {
        waitMs = Math.max(Number(retryAfterMsHeader), 3000);
      } else if (retryAfterHeader) {
        waitMs = Math.max(Number(retryAfterHeader) * 1000, 3000);
      }

      await sleep(waitMs);
      continue;
    }

    return res;
  }

  throw new Error("Max retries reached");
}

export async function POST() {
  try {
    const supabase = getSupabaseServerClient();
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

    const { data: imageAssets, error } = await supabase
      .from("assets")
      .select(`
        id,
        project_id,
        file_name,
        storage_path,
        thumb_url,
        asset_type
      `)
      .eq("asset_type", "Image")
      .is("ai_summary", null)
      .not("storage_path", "is", null);

    if (error) throw error;

    const assets = imageAssets ?? [];

    const results: Array<{
      assetId: string;
      ok: boolean;
      error?: string;
    }> = [];

    for (const asset of assets) {
      try {
        const fileName = asset.file_name ?? "Untitled image";

        // 1) rebuild image content unit
        const { error: deleteError } = await supabase
          .from("asset_content_units")
          .delete()
          .eq("asset_id", asset.id)
          .eq("unit_type", "image");

        if (deleteError) {
          throw deleteError;
        }

        let previewUrl = asset.thumb_url;

        if (!previewUrl && asset.storage_path) {
          const { data } = supabase.storage
            .from(ASSET_BUCKET)
            .getPublicUrl(asset.storage_path);

          previewUrl = data.publicUrl;
        }

        const { error: insertError } = await supabase
          .from("asset_content_units")
          .insert([
            {
              asset_id: asset.id,
              project_id: asset.project_id,
              unit_index: 1,
              unit_type: "image",
              source_format: inferSourceFormat(fileName),
              extracted_text: null,
              generated_text: null,
              preview_url: previewUrl,
              display_label: null,
              display_title: stripExtension(fileName),
              text_kind: null,
              content_kind: "image_heavy",
              meta: {
                asset_type: asset.asset_type,
              },
            },
          ]);

        if (insertError) {
          throw insertError;
        }

        if (!previewUrl) {
          results.push({
            assetId: asset.id,
            ok: false,
            error: "Missing public image URL.",
          });
          continue;
        }

        // 2) call image caption route
        const captionRes = await fetchWithRetry(`${baseUrl}/api/ingest/image`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            imageUrl: previewUrl,
          }),
        });

        const captionPayload = await captionRes.json().catch(() => null);

        if (!captionRes.ok) {
          results.push({
            assetId: asset.id,
            ok: false,
            error: captionPayload?.error ?? "Image caption failed",
          });
          continue;
        }

        const searchText = [
          captionPayload?.caption,
          captionPayload?.imageType,
          ...(captionPayload?.keywords ?? []),
        ]
          .filter(Boolean)
          .join(". ");

        // 3) update content unit
        const { error: contentUpdateError } = await supabase
          .from("asset_content_units")
          .update({
            generated_text: searchText || null,
          })
          .eq("asset_id", asset.id)
          .eq("unit_index", 1)
          .eq("unit_type", "image");

        if (contentUpdateError) {
          throw contentUpdateError;
        }

        // 4) update asset ai_summary
        const { error: assetUpdateError } = await supabase
          .from("assets")
          .update({
            ai_summary: searchText || null,
          })
          .eq("id", asset.id);

        if (assetUpdateError) {
          throw assetUpdateError;
        }

        await sleep(3000);
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

        await sleep(3000);
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
    console.error("Image backfill failed:", error);

    return NextResponse.json(
      {
        ok: false,
        error: error?.message ?? "Image backfill failed.",
      },
      { status: 500 }
    );
  }
}