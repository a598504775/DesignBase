import type { SupabaseClient } from "@supabase/supabase-js";
import type { AssetRow } from "@/lib/assets";

export type ContentUnitType = "image" | "document_page" | "text_block";

export type TextKind = "native_text" | "ocr" | "caption" | "mixed";

export type ContentKind = "image_heavy" | "text_heavy" | "mixed" | "unknown";

export type AssetContentUnitRow = {
  id: string;
  asset_id: string;
  project_id: string;
  unit_index: number;
  unit_type: ContentUnitType | string;
  source_format: string | null;
  extracted_text: string | null;
  generated_text: string | null;
  preview_url: string | null;
  display_label: string | null;
  display_title: string | null;
  text_kind: TextKind | string | null;
  content_kind: ContentKind | string | null;
  meta: Record<string, unknown> | null;
  created_at?: string | null;
};

export function inferSourceFormat(fileName: string): string | null {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  return ext || null;
}

function stripExtension(fileName: string): string {
  const idx = fileName.lastIndexOf(".");
  if (idx <= 0) return fileName;
  return fileName.slice(0, idx);
}

function makeDocxBlockTitle(fileName: string | null, index: number): string {
  const base = stripExtension(fileName ?? "Word Document");
  return `${base} - Block ${index}`;
}

export async function createImageContentUnit(params: {
  supabase: SupabaseClient;
  asset: AssetRow;
}) {
  const { supabase, asset } = params;

  const fileName = asset.file_name ?? "Untitled image";

  const { data, error } = await supabase
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
        preview_url: asset.thumb_url,
        display_label: null,
        display_title: stripExtension(fileName),
        text_kind: null,
        content_kind: "image_heavy",
        meta: {
          asset_type: asset.asset_type,
        },
      },
    ])
    .select(
      "id, asset_id, project_id, unit_index, unit_type, source_format, extracted_text, generated_text, preview_url, display_label, display_title, text_kind, content_kind, meta, created_at"
    )
    .single();

  if (error) throw error;

  return data as AssetContentUnitRow;
}

export async function createPdfPageContentUnit(params: {
  supabase: SupabaseClient;
  assetId: string;
  projectId: string;
  pageNumber: number;
  extractedText: string | null;
}) {
  const { supabase, assetId, projectId, pageNumber, extractedText } = params;

  const { data, error } = await supabase
    .from("asset_content_units")
    .insert([
      {
        asset_id: assetId,
        project_id: projectId,
        unit_index: pageNumber,
        unit_type: "document_page",
        source_format: "pdf",
        extracted_text: extractedText,
        generated_text: null,
        preview_url: null,
        display_label: `Page ${pageNumber}`,
        display_title: null,
        text_kind: "native_text",
        content_kind: "text_heavy",
        meta: null,
      },
    ])
    .select(
      "id, asset_id, project_id, unit_index, unit_type, source_format, extracted_text, generated_text, preview_url, display_label, display_title, text_kind, content_kind, meta, created_at"
    )
    .single();

  if (error) throw error;

  return data;
}

export async function createDocxTextBlockContentUnits(params: {
  supabase: SupabaseClient;
  asset: Pick<AssetRow, "id" | "project_id" | "file_name" | "asset_type">;
  blocks: string[];
}) {
  const { supabase, asset, blocks } = params;

  // Delete old asset in docx text blocks to avoid repetition
  const { error: deleteError } = await supabase
    .from("asset_content_units")
    .delete()
    .eq("asset_id", asset.id)
    .eq("unit_type", "text_block")
    .eq("source_format", "docx");

  if (deleteError) throw deleteError;

  if (blocks.length === 0) {
    return [];
  }

  const rows = blocks.map((text, idx) => ({
    asset_id: asset.id,
    project_id: asset.project_id,
    unit_index: idx + 1,
    unit_type: "text_block",
    source_format: "docx",
    extracted_text: text,
    generated_text: null,
    preview_url: null,
    display_label: `Block ${idx + 1}`,
    display_title: makeDocxBlockTitle(asset.file_name, idx + 1),
    text_kind: "native_text",
    content_kind: "text_heavy",
    meta: {
      asset_type: asset.asset_type,
    },
  }));

  const { data, error } = await supabase
    .from("asset_content_units")
    .insert(rows)
    .select(
      "id, asset_id, project_id, unit_index, unit_type, source_format, extracted_text, generated_text, preview_url, display_label, display_title, text_kind, content_kind, meta, created_at"
    );

  if (error) throw error;

  return (data ?? []) as AssetContentUnitRow[];
}