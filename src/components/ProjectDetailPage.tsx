
"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";

import { createClient } from "@/utils/supabase/client";
import UploadAssetsModal from "./UploadAssetsModal";

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
  project_id: string;
  file_name: string | null;
  notes: string | null;
  thumb_url: string | null;
  created_at: string;
};

function formatDate(iso: string) {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleString();
}

export default function ProjectDetailPage({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<DbProject | null>(null);
  const [assets, setAssets] = useState<DbAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);

  // placeholder：你说 search 先摆设，我们先存起来，后面一行就能接 filter
  const [query, setQuery] = useState("");

  useEffect(() => {
    let canceled = false;

    async function load() {
      setLoading(true);
      setErrMsg(null);

      try {
        const p = await supabase
          .from("projects")
          .select("id,title,description,cover_image_url,created_at")
          .eq("id", projectId)
          .single();

        if (p.error) throw p.error;

        const a = await supabase
          .from("assets")
          .select("id,project_id,file_name,notes,thumb_url,created_at")
          .eq("project_id", projectId)
          .order("created_at", { ascending: false });

        if (a.error) throw a.error;

        if (!canceled) {
          setProject(p.data as DbProject);
          setAssets((a.data ?? []) as DbAsset[]);
        }
      } catch (e: any) {
        if (!canceled) {
          setErrMsg(e?.message ?? "Load failed");
        }
      } finally {
        if (!canceled) setLoading(false);
      }
    }

    load();
    return () => {
      canceled = true;
    };
  }, [projectId]);

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

  if (!project) {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <div className="rounded-xl border p-4">
          <div className="text-lg font-semibold">项目不存在</div>
          <div className="mt-4">
            <Link className="underline" href="/projects">
              返回项目列表
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
          <Link
            className="rounded-lg border px-3 py-2 text-sm hover:bg-muted"
            href="/projects"
          >
            Back
          </Link>

          {/* 先给一个入口，后面你做 upload 真的完善时可以直接接 projectId */}
          <Link
            className="rounded-lg bg-foreground px-3 py-2 text-sm text-background hover:opacity-90"
            href={`/upload?projectId=${encodeURIComponent(projectId)}`}
          >
            Upload Asset
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
          {project.cover_image_url ? (
            <Image
              src={project.cover_image_url}
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
              这个项目还没有任何资产。你可以先点右上角 Upload Asset 传第一张图，确认闭环没问题，然后我们再做 Asset Detail / Tag / 搜索。
            </div>
          ) : (
            <div className="divide-y rounded-2xl border">
              {filteredAssets.map((a) => (
                <Link
                  key={a.id}
                  href={`/assets/${a.id}`}
                  className="flex gap-4 p-4 hover:bg-muted/40"
                >
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
            />
      )}

    </div>
  );
}
