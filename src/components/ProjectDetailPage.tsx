"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";

import { createClient } from "@/utils/supabase/client";
import UploadAssetsModal from "./UploadAssetsModal";

type DbProject = {
  id: string;
  title: string | null;
  description: string | null;
  location: string | null;
  cover_asset_id: string | null;
  created_at: string;
};

type DbAsset = {
  id: string;
  project_id: string;
  file_name: string | null;
  notes: string | null;
  thumb_url: string | null;
  created_at: string;
  storage_path: string | null;
  asset_type: string | null;
  file_size: number | null;
};

const ASSET_TYPE_ORDER = [
  "Image",
  "PDF",
  "Document",
  "Presentation",
  "Spreadsheet",
  "CAD",
  "BIM",
  "3D Model",
  "Video",
  "Archive",
  "Other",
  "Uncategorized",
];

function formatDate(iso: string) {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleString();
}

function formatBytes(bytes: number | null | undefined) {
  if (!bytes || bytes <= 0) return "—";

  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const fixed = value >= 100 || unitIndex === 0 ? 0 : 1;
  return `${value.toFixed(fixed)} ${units[unitIndex]}`;
}

export default function ProjectDetailPage({ projectId }: { projectId: string }) {
  const supabase = useMemo(() => createClient(), []);

  const [project, setProject] = useState<DbProject | null>(null);
  const [assets, setAssets] = useState<DbAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);

  // Selection state
  const [hoveredAssetId, setHoveredAssetId] = useState<string | null>(null);
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [deleting, setDeleting] = useState(false);
  const isSelectionMode = selectedAssetIds.length > 0;

  // Local search
  const [query, setQuery] = useState("");

  // Resolve cover asset
  const coverAsset = useMemo(() => {
    if (!project?.cover_asset_id) return null;
    return assets.find((a) => a.id === project.cover_asset_id) ?? null;
  }, [project, assets]);

  function toggleAssetSelected(assetId: string) {
    setSelectedAssetIds((prev) =>
      prev.includes(assetId)
        ? prev.filter((id) => id !== assetId)
        : [...prev, assetId]
    );
  }

  async function deleteSelectedAssets() {
    if (selectedAssetIds.length === 0) return;

    const confirmed = window.confirm(
      `Delete ${selectedAssetIds.length} selected asset(s)?`
    );
    if (!confirmed) return;

    setDeleting(true);

    try {
      const selectedAssets = assets.filter((a) => selectedAssetIds.includes(a.id));
      const paths = selectedAssets
        .map((a) => a.storage_path)
        .filter((p): p is string => Boolean(p));

      if (paths.length > 0) {
        const storageRes = await supabase.storage
          .from("designbase-assets")
          .remove(paths);

        if (storageRes.error) throw storageRes.error;
      }

      const dbRes = await supabase
        .from("assets")
        .delete()
        .in("id", selectedAssetIds);

      if (dbRes.error) throw dbRes.error;

      setAssets((prev) => prev.filter((a) => !selectedAssetIds.includes(a.id)));
      setSelectedAssetIds([]);
      setHoveredAssetId(null);
    } catch (e: any) {
      console.error(e);
      alert(e?.message ?? "Delete failed");
    } finally {
      setDeleting(false);
    }
  }

  async function loadProjectDetail() {
    setLoading(true);
    setErrMsg(null);

    try {
      const p = await supabase
        .from("projects")
        .select("id,title,description,location,cover_asset_id,created_at")
        .eq("id", projectId)
        .single();

      if (p.error) throw p.error;

      const a = await supabase
        .from("assets")
        .select("id,project_id,file_name,notes,thumb_url,created_at,storage_path,asset_type,file_size")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });

      if (a.error) throw a.error;

      setProject(p.data as DbProject);
      setAssets((a.data ?? []) as DbAsset[]);
    } catch (e: any) {
      setErrMsg(e?.message ?? "Load failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProjectDetail();
  }, [projectId, supabase]);

  const filteredAssets = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return assets;

    return assets.filter((x) => {
      const t = (x.file_name ?? "").toLowerCase();
      return t.includes(q);
    });
  }, [assets, query]);

  const groupedAssets = useMemo(() => {
    const groups = new Map<string, DbAsset[]>();

    for (const asset of filteredAssets) {
      const key = asset.asset_type?.trim() || "Uncategorized";

      if (!groups.has(key)) {
        groups.set(key, []);
      }

      groups.get(key)!.push(asset);
    }

    return Array.from(groups.entries()).sort(([a], [b]) => {
      const ai = ASSET_TYPE_ORDER.indexOf(a);
      const bi = ASSET_TYPE_ORDER.indexOf(b);

      const safeAi = ai === -1 ? Number.MAX_SAFE_INTEGER : ai;
      const safeBi = bi === -1 ? Number.MAX_SAFE_INTEGER : bi;

      return safeAi - safeBi || a.localeCompare(b);
    });
  }, [filteredAssets]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <PageTopBar />
        <div className="mx-auto max-w-[1460px] px-8 py-6">
          <div className="flex items-center justify-end gap-3">
            <div className="h-10 w-20 animate-pulse rounded-[12px] bg-neutral-200" />
            <div className="h-10 w-28 animate-pulse rounded-[12px] bg-neutral-200" />
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[560px_minmax(0,1fr)] lg:items-start">
            <div className="h-[360px] animate-pulse rounded-[18px] bg-neutral-200" />
            <div className="space-y-4">
              <div className="h-10 w-2/3 animate-pulse rounded bg-neutral-200" />
              <div className="h-4 w-1/3 animate-pulse rounded bg-neutral-200" />
              <div className="h-4 w-full animate-pulse rounded bg-neutral-200" />
              <div className="h-4 w-full animate-pulse rounded bg-neutral-200" />
              <div className="h-4 w-5/6 animate-pulse rounded bg-neutral-200" />
              <div className="h-4 w-4/5 animate-pulse rounded bg-neutral-200" />
            </div>
          </div>

          <div className="mt-10 space-y-4">
            <div className="h-24 w-full animate-pulse rounded-[18px] bg-neutral-200" />
            <div className="h-24 w-full animate-pulse rounded-[18px] bg-neutral-200" />
            <div className="h-24 w-full animate-pulse rounded-[18px] bg-neutral-200" />
          </div>
        </div>
      </div>
    );
  }

  if (errMsg) {
    return (
      <div className="min-h-screen bg-white">
        <PageTopBar />
        <div className="mx-auto max-w-[1460px] px-8 py-6">
          <div className="rounded-[18px] border border-red-200 bg-white p-6">
            <div className="text-lg font-semibold">Loading failed</div>
            <div className="mt-2 text-sm text-neutral-500">{errMsg}</div>
            <div className="mt-4">
              <Link className="underline" href="/projects">
                Return to the project list
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-white">
        <PageTopBar />
        <div className="mx-auto max-w-[1460px] px-8 py-6">
          <div className="rounded-[18px] border bg-white p-6">
            <div className="text-lg font-semibold">Project does not exist</div>
            <div className="mt-4">
              <Link className="underline" href="/projects">
                Return to the project list
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Thin shared top bar */}
      <PageTopBar />

      {/* Main content */}
      <main className="mx-auto w-full max-w-[1460px] px-8 py-6">
        {/* Action buttons */}
        <div className="flex items-center justify-end gap-3">
          {isSelectionMode && (
            <button
              className="h-10 rounded-[12px] border border-neutral-300 bg-white px-4 text-sm text-neutral-800 hover:bg-neutral-50"
              onClick={() => setSelectedAssetIds([])}
              disabled={deleting}
            >
              Cancel
            </button>
          )}

          {isSelectionMode && (
            <button
              className="h-10 rounded-[12px] border border-red-200 bg-white px-4 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
              onClick={deleteSelectedAssets}
              disabled={deleting}
            >
              {deleting ? "Deleting..." : `Delete (${selectedAssetIds.length})`}
            </button>
          )}

          <Link
            className="inline-flex h-10 items-center rounded-[12px] border border-neutral-300 bg-white px-4 text-sm text-neutral-800 hover:bg-neutral-50"
            href="/projects"
          >
            Back
          </Link>

          <button
            onClick={() => setUploadOpen(true)}
            className="h-10 rounded-[12px] border border-[#69c98e] bg-[#8fdbab] px-4 text-sm font-medium text-black transition hover:brightness-95"
          >
            Upload Asset
          </button>
        </div>

        {/* Project overview */}
        <section className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[560px_minmax(0,1fr)] lg:items-start">
          {/* Fixed-height cover image */}
          <div className="overflow-hidden rounded-[18px] border border-neutral-200 bg-white">
            <div className="relative h-[360px] w-full bg-neutral-100">
              {coverAsset?.thumb_url ? (
                <Image
                  src={coverAsset.thumb_url}
                  alt="Project cover"
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 560px"
                  priority
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-sm text-neutral-500">
                  No cover image
                </div>
              )}
            </div>
          </div>

          {/* Project text block */}
          <div className="min-w-0">
            <div className="text-[30px] font-semibold leading-tight text-neutral-950">
              {project.title ?? "Untitled Project"}
            </div>

            <div className="mt-2 text-sm text-neutral-500">
              {project.location ?? "No location"}
            </div>

            <div className="mt-4 line-clamp-10 text-[15px] leading-7 text-neutral-700">
              {project.description ?? "No description"}
            </div>
          </div>
        </section>

        {/* Assets section */}
        <section className="mt-10">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-[28px] font-semibold tracking-tight text-neutral-950">
              Assets{" "}
              <span className="text-base font-normal text-neutral-400">
                ({filteredAssets.length})
              </span>
            </div>

            <div className="flex items-center gap-2">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search"
                className="h-10 w-full rounded-[12px] border border-neutral-300 bg-white px-4 text-[14px] text-neutral-800 outline-none placeholder:text-neutral-400 focus:border-neutral-500 sm:w-80"
              />
            </div>
          </div>

          <div className="mt-5">
            {filteredAssets.length === 0 ? (
              <div className="rounded-[18px] border border-neutral-200 bg-white p-6 text-sm text-neutral-500">
                No asset.
              </div>
            ) : (
              <div className="space-y-5">
                {groupedAssets.map(([groupName, groupAssets]) => (
                  <div
                    key={groupName}
                    className="overflow-hidden rounded-[18px] border border-neutral-200 bg-white"
                  >
                    {/* Group header */}
                    <div className="flex items-center justify-between border-b border-neutral-200 bg-neutral-50 px-4 py-3">
                      <div className="text-sm font-semibold text-neutral-900">
                        {groupName}
                      </div>
                      <div className="text-xs text-neutral-400">
                        {groupAssets.length}
                      </div>
                    </div>

                    {/* Group body */}
                    <div className="divide-y divide-neutral-200">
                      {groupAssets.map((a) => (
                        <div
                          key={a.id}
                          className="flex items-center gap-3 px-4 py-2.5 hover:bg-neutral-50"
                          onMouseEnter={() => setHoveredAssetId(a.id)}
                          onMouseLeave={() =>
                            setHoveredAssetId((prev) => (prev === a.id ? null : prev))
                          }
                        >
                          {/* Checkbox column */}
                          <div className="flex w-5 shrink-0 items-center justify-center self-stretch">
                            {(isSelectionMode || hoveredAssetId === a.id) && (
                              <input
                                type="checkbox"
                                checked={selectedAssetIds.includes(a.id)}
                                onChange={() => toggleAssetSelected(a.id)}
                                onClick={(e) => e.stopPropagation()}
                                disabled={deleting}
                              />
                            )}
                          </div>

                          {/* Asset row link */}
                          <Link
                            href={`/assets/${a.id}`}
                            className="flex min-w-0 flex-1 items-center gap-3"
                          >
                            {/* Preview */}
                            <div className="relative h-12 w-20 shrink-0 overflow-hidden rounded-[10px] bg-neutral-100 sm:h-14 sm:w-24">
                              {a.thumb_url ? (
                                <Image
                                  src={a.thumb_url}
                                  alt="Asset preview"
                                  fill
                                  className="object-cover"
                                  sizes="96px"
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-[11px] text-neutral-400">
                                  No preview
                                </div>
                              )}
                            </div>

                            {/* File name and size */}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="truncate text-[14px] font-medium text-neutral-900">
                                    {a.file_name ?? "Untitled Asset"}
                                  </div>

                                  <div className="mt-0.5 text-[12px] text-neutral-500">
                                    {formatBytes(a.file_size)}
                                  </div>
                                </div>

                                <div className="shrink-0 text-[12px] text-neutral-400">
                                  {formatDate(a.created_at)}
                                </div>
                              </div>
                            </div>
                          </Link>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Upload modal */}
        {uploadOpen && (
          <UploadAssetsModal
            onClose={() => setUploadOpen(false)}
            open={uploadOpen}
            projectId={projectId}
            onUpdated={loadProjectDetail}
          />
        )}
      </main>
    </div>
  );
}

/* ---------- Thin full-width top bar ---------- */
function PageTopBar() {
  return (
    <header className="w-full border-b border-neutral-200 bg-white">
      <div className="mx-auto flex h-10 w-full max-w-[1460px] items-center justify-between px-8">
        <div className="text-[16px] font-medium text-neutral-900">
          Sample design base
        </div>

        <div className="flex items-center gap-2">
          <div className="text-xs text-neutral-800">Admin</div>
          <div className="h-7 w-7 rounded-full border border-neutral-500 bg-white" />
        </div>
      </div>
    </header>
  );
}