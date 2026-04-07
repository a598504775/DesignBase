import type { SupabaseClient } from "@supabase/supabase-js";

export const ASSET_BUCKET = "designbase-assets";

export type AssetKind = "cover" | "asset";

export type AssetRow = {
  id: string;
  project_id: string;
  file_name: string | null;
  storage_path: string | null;
  thumb_url: string | null;
  notes: string | null;
  file_size: number | null;
  created_at?: string | null;
};

function sanitizeFileName(fileName: string) {
  return fileName
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "");
}

export function buildAssetStoragePath(params: {
  projectId: string;
  fileName: string;
  kind?: AssetKind;
}) {
  const { projectId, fileName, kind = "asset" } = params;
  const safeName = sanitizeFileName(fileName);

  if (kind === "cover") {
    return `projects/${projectId}/cover/${safeName}`;
  }

  return `projects/${projectId}/assets/${safeName}`;
}

export async function uploadFileToStorage(params: {
  supabase: SupabaseClient;
  file: File;
  storagePath: string;
  bucket?: string;
}) {
  const {
    supabase,
    file,
    storagePath,
    bucket = ASSET_BUCKET,
  } = params;

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(storagePath, file, {
      upsert: false,
      contentType: file.type || undefined,
    });

  if (uploadError) {
    throw uploadError;
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(storagePath);

  return {
    storagePath,
    publicUrl: data.publicUrl,
  };
}

export async function removeFilesFromStorage(params: {
  supabase: SupabaseClient;
  paths: Array<string | null | undefined>;
  bucket?: string;
}) {
  const {
    supabase,
    paths,
    bucket = ASSET_BUCKET,
  } = params;

  const normalizedPaths = paths.filter((p): p is string => Boolean(p));

  if (normalizedPaths.length === 0) {
    return;
  }

  const { error } = await supabase.storage
    .from(bucket)
    .remove(normalizedPaths);

  if (error) {
    throw error;
  }
}

export async function createAssetRow(params: {
  supabase: SupabaseClient;
  projectId: string;
  file: File;
  storagePath: string;
  thumbUrl: string | null;
  notes?: string | null;
}) {
  const {
    supabase,
    projectId,
    file,
    storagePath,
    thumbUrl,
    notes = null,
  } = params;

  const { data, error } = await supabase
    .from("assets")
    .insert([
      {
        project_id: projectId,
        file_name: file.name,
        storage_path: storagePath,
        thumb_url: thumbUrl,
        notes,
        file_size: file.size,
      },
    ])
    .select(
      "id, project_id, file_name, storage_path, thumb_url, notes, file_size, created_at"
    )
    .single();

  if (error) {
    throw error;
  }

  return data as AssetRow;
}