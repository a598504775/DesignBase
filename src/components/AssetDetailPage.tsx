"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/utils/supabase/client";

const supabase = createClient();

type DbProject = {
  id: string;
  title: string | null;
  description: string | null;
  cover_image_url: string | null;
  created_at: string;
};

type DbAsset = {
  id: string;
  project_id: string | null;
  created_at: string;
  file_name: string | null;
  storage_path: string | null;
  notes: string | null;
  file_size: number | null;
  uploaded_at: string | null;
  thumb_url: string | null;
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleString();
}

function formatBytes(bytes: number | null) {
  if (bytes == null) return "—";
  const b = Number(bytes);
  if (!Number.isFinite(b)) return String(bytes);
  const units = ["B", "KB", "MB", "GB", "TB"];
  let v = b;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(i === 0 ? 0 : 2)} ${units[i]}`;
}

function guessIsImage(pathOrName: string | null) {
  if (!pathOrName) return false;
  const s = pathOrName.toLowerCase();
  return (
    s.endsWith(".png") ||
    s.endsWith(".jpg") ||
    s.endsWith(".jpeg") ||
    s.endsWith(".webp") ||
    s.endsWith(".gif")
  );
}

export default function AssetDetailPage({ assetId }: { assetId: string }) {
  const [asset, setAsset] = useState<DbAsset | null>(null);
  const [project, setProject] = useState<DbProject | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  useEffect(() => {
    let canceled = false;

    async function load() {
      setLoading(true);
      setErrMsg(null);

      try {
        const a = await supabase
          .from("assets")
          .select("id,project_id,created_at,file_name,storage_path,notes,file_size,uploaded_at")
          .eq("id", assetId)
          .single();

        if (a.error) throw a.error;

        if (canceled) return;

        const assetData = a.data as DbAsset;
        setAsset(assetData);

        // 1) 取 project
        if (assetData.project_id) {
          const p = await supabase
            .from("projects")
            .select("id,title,description,cover_image_url,created_at")
            .eq("id", assetData.project_id)
            .single();

          if (!canceled) {
            if (p.error) {
              // project 不存在也不至于整页崩，给个弱提示
              setProject(null);
            } else {
              setProject(p.data as DbProject);
            }
          }
        }

        // 2) 生成文件 public url（依赖你的 bucket 是 public）
        // 你目前 assets 表只有 storage_path，没有 bucket 字段，所以我用一个“默认 bucket”写法：
        // 把 DEFAULT_BUCKET 改成你实际 bucket 名字即可，比如 "designbase" / "assets" / "uploads"
        const DEFAULT_BUCKET = "designbase-assets";

        if (assetData.storage_path) {
          const { data } = supabase.storage
            .from(DEFAULT_BUCKET)
            .getPublicUrl(assetData.storage_path);

          const url = data?.publicUrl ?? null;
          if (!canceled) setFileUrl(url);
        } else {
          if (!canceled) setFileUrl(null);
        }
      } catch (e: any) {
        if (!canceled) setErrMsg(e?.message ?? "Load failed");
      } finally {
        if (!canceled) setLoading(false);
      }
    }

    load();
    return () => {
      canceled = true;
    };
  }, [assetId]);

  const isImage = useMemo(() => {
    if (!asset) return false;
    return guessIsImage(asset.storage_path) || guessIsImage(asset.file_name);
  }, [asset]);

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <div className="h-8 w-64 animate-pulse rounded bg-muted" />
        <div className="mt-4 h-80 w-full animate-pulse rounded-2xl bg-muted" />
        <div className="mt-6 space-y-3">
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
          <div className="text-lg font-semibold">加载失败</div>
          <div className="mt-2 text-sm text-muted-foreground">{errMsg}</div>
          <div className="mt-4">
            <Link className="underline" href="/projects">
              返回项目列表
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!asset) {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <div className="rounded-xl border p-4">
          <div className="text-lg font-semibold">Asset 不存在</div>
          <div className="mt-4">
            <Link className="underline" href="/projects">
              返回项目列表
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const backHref = asset.project_id ? `/projects/${asset.project_id}` : "/projects";

  return (
    <div className="mx-auto max-w-5xl p-6">
      {/* Top bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="text-2xl font-semibold truncate">
            {asset.file_name ?? "Untitled Asset"}
          </div>
          <div className="mt-1 text-sm text-muted-foreground">
            {project?.title ? (
              <>
                Project:{" "}
                <Link className="underline" href={`/projects/${project.id}`}>
                  {project.title}
                </Link>
              </>
            ) : (
              <>Project: —</>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <Link className="rounded-lg border px-3 py-2 text-sm hover:bg-muted" href={backHref}>
            Back
          </Link>

          {fileUrl ? (
            <a
              className="rounded-lg bg-foreground px-3 py-2 text-sm text-background hover:opacity-90"
              href={fileUrl}
              target="_blank"
              rel="noreferrer"
            >
              Open file
            </a>
          ) : (
            <div className="rounded-lg border px-3 py-2 text-sm text-muted-foreground">
              No public URL
            </div>
          )}
        </div>
      </div>

      {/* Preview */}
      <div className="mt-6 overflow-hidden rounded-2xl border">
        <div className="relative h-[420px] w-full bg-muted">
          {isImage && fileUrl ? (
            <Image
              src={fileUrl}
              alt={asset.file_name ?? "asset"}
              fill
              className="object-contain"
              sizes="(max-width: 1024px) 100vw, 1024px"
              priority
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
              <div>Preview not available</div>
              <div className="text-xs">
                {asset.storage_path ? `storage_path: ${asset.storage_path}` : "storage_path: —"}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Meta */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border p-4">
          <div className="text-sm font-medium">File</div>
          <div className="mt-2 text-sm text-muted-foreground">
            <div>File name: {asset.file_name ?? "—"}</div>
            <div className="mt-1">Size: {formatBytes(asset.file_size)}</div>
            <div className="mt-1">Created: {formatDate(asset.created_at)}</div>
            <div className="mt-1">Uploaded: {formatDate(asset.uploaded_at)}</div>
          </div>
        </div>

        <div className="rounded-2xl border p-4">
          <div className="text-sm font-medium">Notes</div>
          <div className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
            {asset.notes?.trim() ? asset.notes : "—"}
          </div>
        </div>
      </div>

      {/* Project info (optional display) */}
      <div className="mt-6 rounded-2xl border p-4">
        <div className="text-sm font-medium">Project snapshot</div>
        <div className="mt-2 text-sm text-muted-foreground">
          <div>Title: {project?.title ?? "—"}</div>
          <div className="mt-1">
            Description: {project?.description ?? "—"}
          </div>
        </div>
      </div>
    </div>
  );
}
