
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
};

function formatDate(iso: string) {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleString();
}

export default function ProjectDetailPage({ projectId }: { projectId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [project, setProject] = useState<DbProject | null>(null);
  const [assets, setAssets] = useState<DbAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);

  //Selection Mode
  const [hoveredAssetId, setHoveredAssetId] = useState<string | null>(null);
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [deleting, setDeleting] = useState(false);
  const isSelectionMode = selectedAssetIds.length > 0;

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

  // placeholder：filter
  const [query, setQuery] = useState("");
  async function loadProjectDetail() {
    setLoading(true);
    setErrMsg(null);

    try {
      const p = await supabase
        .from("projects")
        .select("id,title,description,cover_asset_id,created_at")
        .eq("id", projectId)
        .single();

      if (p.error) throw p.error;

      const a = await supabase
        .from("assets")
        .select("id,project_id,file_name,notes,thumb_url,created_at,storage_path")
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
      const d = (x.notes ?? "").toLowerCase();
      return t.includes(q) || d.includes(q);
    });
  }, [assets, query]);

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <div className="h-8 w-64 animate-pulse rounded bg-muted" />
        <div className="mt-4 h-28 w-full animate-pulse rounded-xl bg-muted" />
        <div className="mt-6 space-y-3">
          <div className="h-16 w-full animate-pulse rounded-xl bg-muted" />
          <div className="h-16 w-full animate-pulse rounded-xl bg-muted" />
          <div className="h-16 w-full animate-pulse rounded-xl bg-muted" />
        </div>
      </div>
    );
  }

  if (errMsg) {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <div className="rounded-xl border p-4">
          <div className="text-lg font-semibold">Loading failed</div>
          <div className="mt-2 text-sm text-muted-foreground">{errMsg}</div>
          <div className="mt-4">
            <Link className="underline" href="/projects">
              Return to the project list
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <div className="rounded-xl border p-4">
          <div className="text-lg font-semibold">Project doesn't exist</div>
          <div className="mt-4">
            <Link className="underline" href="/projects">
              Return to the project list
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="text-2xl font-semibold truncate">
            {project.title ?? "Untitled Project"}
          </div>
          <div className="mt-1 text-sm text-muted-foreground">
            {project.description ?? "No description"}
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            Created: {formatDate(project.created_at)}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          {isSelectionMode && (
            <button
              className="rounded-lg border px-3 py-2 text-sm hover:bg-muted"
              onClick={() => setSelectedAssetIds([])}
              disabled={deleting}
            >
              Cancel
            </button>
          )}
          {isSelectionMode && (
            <button
              className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
              onClick={deleteSelectedAssets}
              disabled={deleting}
            >
              {deleting ? "Deleting..." : `Delete (${selectedAssetIds.length})`}
            </button>
          )}

          <Link
            className="rounded-lg border px-3 py-2 text-sm hover:bg-muted"
            href="/projects"
          >
            Back
          </Link>


          <button
            onClick={() => setUploadOpen(true)}
            className="px-3 py-2 border rounded-lg text-sm hover:opacity-90 bg-foreground text-background"
          >
              Upload Asset
          </button>
        </div>
      </div>

      {/* Cover */}
      <div className="mt-5 overflow-hidden rounded-2xl border">
        <div className="relative h-44 w-full bg-muted sm:h-56">
          {coverAsset?.thumb_url ? (
            <Image
              src={coverAsset.thumb_url}
              alt="Project cover"
              fill
              className="object-cover"
              sizes="(max-width: 1024px) 100vw, 1024px"
              priority
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
              No cover image
            </div>
          )}
        </div>
      </div>

      {/* Assets section */}
      <div className="mt-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-lg font-semibold">
            Assets{" "}
            <span className="text-sm font-normal text-muted-foreground">
              ({filteredAssets.length})
            </span>
          </div>

          <div className="flex items-center gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search (placeholder, but works locally)"
              className="h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring sm:w-80"
            />
          </div>
        </div>

        <div className="mt-4">
          {filteredAssets.length === 0 ? (
            <div className="rounded-xl border p-6 text-sm text-muted-foreground">
              No asset.
            </div>
          ) : (
            <div className="divide-y rounded-2xl border">
              {filteredAssets.map((a) => (
              <div
                key={a.id}
                className="flex gap-4 p-4 hover:bg-muted/40"
                onMouseEnter={() => setHoveredAssetId(a.id)}
                onMouseLeave={() => setHoveredAssetId((prev) => (prev === a.id ? null : prev))}
              >
                <div className="w-5 shrink-0 pt-1">
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

                <Link href={`/assets/${a.id}`} className="flex flex-1 gap-4 min-w-0">
                  <div className="relative h-16 w-20 overflow-hidden rounded-lg bg-muted sm:h-20 sm:w-28">
                    {a.thumb_url ? (
                      <Image
                        src={a.thumb_url}
                        alt="Asset thumb"
                        fill
                        className="object-cover"
                        sizes="112px"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                        No thumb
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-medium">
                          {a.file_name ?? "Untitled Asset"}
                        </div>
                        <div className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                          {a.notes ?? "No description"}
                        </div>
                      </div>

                      <div className="shrink-0 text-xs text-muted-foreground">
                        {formatDate(a.created_at)}
                      </div>
                    </div>
                  </div>
                </Link>
              </div>
              ))}
            </div>
          )}
        </div>
      </div>


      {uploadOpen && (
            <UploadAssetsModal
              onClose={() => setUploadOpen(false)}
              open={uploadOpen}
              projectId={projectId}
              onUpdated={loadProjectDetail}
            />
      )}

    </div>
  );
}
