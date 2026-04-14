import type { SupabaseClient } from "@supabase/supabase-js";

// Review this
export type ContentUnitSearchRow = {
  id: string;
  asset_id: string;
  project_id: string;
  unit_index: number;
  unit_type: string;
  source_format: string | null;
  extracted_text: string | null;
  generated_text: string | null;
  preview_url: string | null;
  display_label: string | null;
  display_title: string | null;
  text_kind: string | null;
  content_kind: string | null;
  meta: Record<string, unknown> | null;
  created_at: string | null;

  project_title: string | null;
  asset_file_name: string | null;
  snippet: string | null;
};

function buildSnippet(text: string | null, maxLength = 160): string | null {
  if (!text) return null;
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return null;
  return normalized.length <= maxLength
    ? normalized
    : `${normalized.slice(0, maxLength)}...`;
}

export async function searchContentUnits(params: {
  supabase: SupabaseClient;
  query: string;
  limit?: number;
}) {
  const { supabase, query, limit = 24 } = params;

  const q = query.trim();

  let request = supabase
    .from("asset_content_units")
    .select(
      `
      id,
      asset_id,
      project_id,
      unit_index,
      unit_type,
      source_format,
      extracted_text,
      generated_text,
      preview_url,
      display_label,
      display_title,
      text_kind,
      content_kind,
      meta,
      created_at
      `
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (q) {
    request = request.or(
      [
        `display_title.ilike.%${q}%`,
        `display_label.ilike.%${q}%`,
        `extracted_text.ilike.%${q}%`,
        `generated_text.ilike.%${q}%`,
      ].join(",")
    );
  }

  const { data, error } = await request;
  if (error) throw error;

  const rows = (data ?? []) as Omit<
    ContentUnitSearchRow,
    "project_title" | "asset_file_name" | "snippet"
  >[];

  if (rows.length === 0) {
    return [];
  }

  const projectIds = Array.from(new Set(rows.map((row) => row.project_id)));
  const assetIds = Array.from(new Set(rows.map((row) => row.asset_id)));

  const [{ data: projectRows, error: projectError }, { data: assetRows, error: assetError }] =
    await Promise.all([
      supabase.from("projects").select("id, title").in("id", projectIds),
      supabase.from("assets").select("id, file_name").in("id", assetIds),
    ]);

  if (projectError) throw projectError;
  if (assetError) throw assetError;

  const projectMap = new Map(
    (projectRows ?? []).map((row) => [row.id, row.title as string | null])
  );
  const assetMap = new Map(
    (assetRows ?? []).map((row) => [row.id, row.file_name as string | null])
  );

  return rows.map((row) => ({
    ...row,
    project_title: projectMap.get(row.project_id) ?? null,
    asset_file_name: assetMap.get(row.asset_id) ?? null,
    snippet: buildSnippet(row.extracted_text ?? row.generated_text),
  }));
}