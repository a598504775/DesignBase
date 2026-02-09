'use client';

import { useEffect, useMemo, useState } from 'react';
import { ProjectCreateForm } from '@/components/ProjectCreateForm';
import { createClient } from "@/utils/supabase/client";

type Project = {
  id: string,
  title: string,
  description: string | null,
  cover_image_url: string | null,
  location: string | null,
  created_at?: string
};

type LoadState = 'idle' | 'loading' | 'error' | 'ready';
const supabase = createClient();

export default function ProjectsPage() {
  // 1) Toolbar state
  const [query, setQuery] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // 2) Data state
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('idle');
  const [errorMsg, setErrorMsg] = useState<string>('');

  // 3) Fetch (先做最小可运行：你接 Supabase 时把这里替换掉)
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoadState('loading');
        setErrorMsg('');

        // TODO: 接 Supabase 时，把下面这段替换成真实 fetch
        // const { data, error } = await supabase.from('projects').select('*').order('updated_at', { ascending: false });
        // if (error) throw error;
        // if (!cancelled) setProjects(data ?? []);

        const { data, error } = await supabase.from('projects').select('*').order('created_at', {ascending: false});
        if (error) throw error;

        if (!cancelled) {
          setProjects(data ?? []);
          setLoadState('ready');
        }
      } catch (e: any) {
        if (!cancelled) {
          setLoadState('error');
          setErrorMsg(e?.message ?? 'Failed to load projects.');
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // 4) Derived list
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter((p) => {
      const t = (p.title ?? '').toLowerCase();
      const d = (p.description ?? '').toLowerCase();
      return t.includes(q) || d.includes(q);
    });
  }, [projects, query]);

  // 5) Handlers
  function handleCreated(newProject: Project) {
    setProjects((prev) => [newProject, ...prev]);
    setIsCreateOpen(false);
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-8">
      <SearchBar
        query={query}
        onQueryChange={setQuery}
        onClickCreate={() => setIsCreateOpen(true)}
      />

      <div className="mt-6">
        {loadState === 'loading' && <ProjectsSkeleton />}
        {loadState === 'error' && (
          <ErrorState
            message={errorMsg}
            onRetry={() => window.location.reload()}
          />
        )}
        {loadState === 'ready' && filtered.length === 0 && (
          <EmptyState onClickCreate={() => setIsCreateOpen(true)} />
        )}
        {loadState === 'ready' && filtered.length > 0 && (
          <ProjectsList projects={filtered} />
        )}
      </div>

      {isCreateOpen && (
        <Modal title="Create Project" onClose={() => setIsCreateOpen(false)}>
          {/* 你在 ProjectCreateForm 里只要在创建成功时调用 onCreated 即可 */}
          {/* <ProjectCreateForm onCreated={handleCreated} onCancel={() => setIsCreateOpen(false)} /> */}
          <ProjectCreateForm/>
        </Modal>
      )}
    </div>
  );
}

/** ========== 分区 1：PageHeader / Toolbar（Search + Create） ========== */
function SearchBar(props: {
  query: string;
  onQueryChange: (v: string) => void;
  onClickCreate: () => void;
}) {
  return (
    <div className="flex items-center ">
      <div className="flex-1">
        <input
          value={props.query}
          onChange={(e) => props.onQueryChange(e.target.value)}
          placeholder="Search (placeholder)…"
          className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-neutral-400"
        />
      </div>

      <button
        onClick={props.onClickCreate}
        className="rounded-xl bg-black px-4 py-2.5 text-sm font-medium text-white hover:opacity-90"
      >
        Create Project
      </button>
    </div>
  );
}

/** ========== 分区 2：List 容器 + Row（封面 / 标题 / 描述 / 轻量信息） ========== */
function ProjectsList({ projects }: { projects: Project[] }) {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {projects.map((p) => (
        <ProjectCard key={p.id} project={p} />
      ))}
    </div>
  );
}


function ProjectCard({ project }: { project: Project }) {
  return (
    <a
      href={`/projects/${project.id}`}
      className="h-80 group overflow-hidden bg-white transition hover:shadow-md"
    >
      <CoverThumb url={project.cover_image_url}/>
      <div className="mt-1 truncate text-sm text-neutral-600">
        {project.location || '-'}
      </div>
      
      <div className="mt-0 line-clamp-3 text-sm leading-6 text-neutral-700 ">
        {project.description || 'No description yet'}
      </div>
    </a>
  );
}

function CoverThumb({ url }: { url: string | null }) {
  if (url) {
    return (
      <img
        src={url}
        alt="cover"
        className="h-40 w-full shrink-0 object-cover transition group-hover:scale-[1.02]"
      />
    );
  }
  return (
    <div className="flex h-44 w-full shrink-0 items-center justify-center bg-neutural-100 text0sm text-neutral-500">
      No cover
    </div>
  );
}

/** ========== 分区 3：Empty / Loading / Error 状态 ========== */
function EmptyState({ onClickCreate }: { onClickCreate: () => void }) {
  return (
    <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-10 text-center">
      <div className="text-sm font-semibold text-neutral-900">No projects yet</div>
      <div className="mt-2 text-sm text-neutral-600">
        Create your first project to start uploading assets.
      </div>
      <button
        onClick={onClickCreate}
        className="mt-5 rounded-xl bg-black px-4 py-2.5 text-sm font-medium text-white hover:opacity-90"
      >
        Create your first project
      </button>
    </div>
  );
}

function ProjectsSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 border-b border-neutral-100 p-4">
          <div className="h-14 w-20 rounded-xl bg-neutral-100" />
          <div className="flex-1">
            <div className="h-4 w-56 rounded bg-neutral-100" />
            <div className="mt-2 h-4 w-80 rounded bg-neutral-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-2xl border border-red-200 bg-white p-6">
      <div className="text-sm font-semibold text-red-700">Failed to load projects</div>
      <div className="mt-2 text-sm text-neutral-700">{message}</div>
      <button
        onClick={onRetry}
        className="mt-4 rounded-xl border border-neutral-300 bg-white px-4 py-2 text-sm hover:bg-neutral-50"
      >
        Retry
      </button>
    </div>
  );
}

/** ========== 分区 4：最小 Modal（先不用 shadcn，保证不报依赖错） ========== */
function Modal(props: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-xl rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4">
          <div className="text-sm font-semibold">{props.title}</div>
          <button
            onClick={props.onClose}
            className="rounded-lg px-2 py-1 text-sm text-neutral-600 hover:bg-neutral-100"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="px-5 py-5">{props.children}</div>
      </div>
    </div>
  );
}

function formatDate(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString();
  } catch {
    return '—';
  }
}
