import type { SupabaseClient } from "@supabase/supabase-js";

export type AssetSearchRow = {
  id: string;
  project_id: string;
  project_title: string | null;
  file_name: string | null;
  storage_path: string | null;
  thumb_url: string | null;
  asset_type: string | null;
  uploaded_at: string | null;
  ai_summary: string | null;
};

export async function searchAssets(params: {
  supabase: SupabaseClient;
  query: string;
  limit?: number;
}) {
  const { supabase, query, limit = 24 } = params;

  const q = query.trim();

  let request = supabase
    .from("assets")
    .select(
      `
      id,
      project_id,
      file_name,
      storage_path,
      thumb_url,
      asset_type,
      uploaded_at,
      ai_summary
      `
    )
    .order("uploaded_at", { ascending: false })
    .limit(limit);

  if (q) {
    request = request.or(
      [
        `file_name.ilike.%${q}%`,
        `notes.ilike.%${q}%`,
        `ai_summary.ilike.%${q}%`,
      ].join(",")
    );
  }

  const { data, error } = await request;
  if (error) throw error;

  const rows = (data ?? []) as Omit<AssetSearchRow, "project_title">[];

  if (rows.length === 0) {
    return [];
  }

  const projectIds = Array.from(new Set(rows.map((row) => row.project_id)));

  const { data: projectRows, error: projectError } = await supabase
    .from("projects")
    .select("id, title")
    .in("id", projectIds);

  if (projectError) throw projectError;

  const projectMap = new Map(
    (projectRows ?? []).map((row) => [row.id, row.title as string | null])
  );

  return rows.map((row) => ({
    ...row,
    project_title: projectMap.get(row.project_id) ?? null,
  }));
}