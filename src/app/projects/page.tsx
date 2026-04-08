'use client';

import { useEffect, useMemo, useState } from 'react';
import { ProjectCreateForm } from '@/components/ProjectCreateForm';
import { createClient } from '@/utils/supabase/client';

type Project = {
  id: string;
  title: string | null;
  description: string | null;
  location: string | null;
  created_at?: string | null;
  cover_asset_id: string | null;
  project_type: string | null;
  cover_thumb_url: string | null;
};

type LoadState = 'idle' | 'loading' | 'error' | 'ready';

export default function ProjectsPage() {
  const supabase = createClient();

  // State for project tile action menu
  const [openMenuProjectId, setOpenMenuProjectId] = useState<string | null>(null);

  // State for toolbar and modal
  const [query, setQuery] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // State for project data loading
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  // State for delete progress
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);

  // Close project menu when clicking outside
  useEffect(() => {
    function handleGlobalClick() {
      setOpenMenuProjectId(null);
    }

    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, []);

  // Load projects and resolve cover thumbnail URLs
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoadState('loading');
        setErrorMsg('');

        const { data: projectRows, error: projectError } = await supabase
          .from('projects')
          .select('id,title,description,location,created_at,cover_asset_id,project_type')
          .order('created_at', { ascending: false });

        if (projectError) throw projectError;

        const coverIds = (projectRows ?? [])
          .map((p) => p.cover_asset_id)
          .filter((id): id is string => Boolean(id));

        let coverMap = new Map<string, string | null>();

        if (coverIds.length > 0) {
          const { data: assetRows, error: assetError } = await supabase
            .from('assets')
            .select('id, thumb_url')
            .in('id', coverIds);

          if (assetError) throw assetError;

          coverMap = new Map(
            (assetRows ?? []).map((row) => [row.id, row.thumb_url])
          );
        }

        const normalizedProjects: Project[] = (projectRows ?? []).map((p) => ({
          ...p,
          cover_thumb_url: p.cover_asset_id
            ? coverMap.get(p.cover_asset_id) ?? null
            : null,
        }));

        if (!cancelled) {
          setProjects(normalizedProjects);
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
  }, [supabase]);

  // Local search filter
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return projects;

    return projects.filter((p) => {
      const t = (p.title ?? '').toLowerCase();
      const d = (p.description ?? '').toLowerCase();
      const l = (p.location ?? '').toLowerCase();
      const pt = (p.project_type ?? '').toLowerCase();

      return (
        t.includes(q) ||
        d.includes(q) ||
        l.includes(q) ||
        pt.includes(q)
      );
    });
  }, [projects, query]);

  // Insert a newly created project into the current list
  function handleCreated(newProject: Project) {
    setProjects((prev) => [newProject, ...prev]);
    setIsCreateOpen(false);
  }

  // Delete one project and its files
  async function handleDeleteProject(projectId: string) {
    const confirmed = window.confirm(
      'Delete this project? This will permanently delete the project, its assets, and related tag links.'
    );
    if (!confirmed) return;

    setDeletingProjectId(projectId);

    try {
      const assetsRes = await supabase
        .from('assets')
        .select('id, storage_path')
        .eq('project_id', projectId);

      if (assetsRes.error) throw assetsRes.error;

      const paths = (assetsRes.data ?? [])
        .map((a) => a.storage_path)
        .filter((p): p is string => Boolean(p));

      if (paths.length > 0) {
        const storageRes = await supabase.storage
          .from('designbase-assets')
          .remove(paths);

        if (storageRes.error) throw storageRes.error;
      }

      const projectRes = await supabase
        .from('projects')
        .delete()
        .eq('id', projectId);

      if (projectRes.error) throw projectRes.error;

      setProjects((prev) => prev.filter((p) => p.id !== projectId));
    } catch (e: any) {
      console.error(e);
      alert(e?.message ?? 'Delete project failed.');
    } finally {
      setDeletingProjectId(null);
    }
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Full-width thin top bar */}
      <PageTopBar />

      {/* Main content container */}
      <main className="mx-auto w-full max-w-[1460px] px-8 py-6">
        {/* Page title and toolbar */}
        <ProjectsToolbar
          query={query}
          onQueryChange={setQuery}
          onClickCreate={() => setIsCreateOpen(true)}
        />

        {/* Main project content */}
        <section className="mt-8">
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
            <ProjectsGrid
              projects={filtered}
              deletingProjectId={deletingProjectId}
              openMenuProjectId={openMenuProjectId}
              onOpenMenu={setOpenMenuProjectId}
              onDeleteProject={handleDeleteProject}
            />
          )}
        </section>

        {/* Create project modal */}
        {isCreateOpen && (
          <Modal title="Create Project" onClose={() => setIsCreateOpen(false)}>
            <ProjectCreateForm
              onCreated={handleCreated}
              onCancel={() => setIsCreateOpen(false)}
            />
          </Modal>
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

/* ---------- Title row and compact toolbar ---------- */
function ProjectsToolbar(props: {
  query: string;
  onQueryChange: (v: string) => void;
  onClickCreate: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      {/* Title row */}
      <div className="flex items-center justify-between">
        <h1 className="text-[38px] font-semibold tracking-tight text-black">
          Projects
        </h1>

        <button
          onClick={props.onClickCreate}
          className="h-10 rounded-[12px] border border-[#69c98e] bg-[#8fdbab] px-5 text-[15px] font-medium text-black transition hover:brightness-95"
        >
          new project
        </button>
      </div>

      {/* Search and placeholder controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-[320px] flex-1">
          <input
            value={props.query}
            onChange={(e) => props.onQueryChange(e.target.value)}
            placeholder="Search"
            className="h-10 w-full rounded-[12px] border border-neutral-300 bg-white px-4 text-[14px] text-neutral-800 outline-none placeholder:text-neutral-400 focus:border-neutral-500"
          />
        </div>

        <button className="h-10 rounded-[12px] border border-neutral-300 bg-white px-4 text-[14px] text-neutral-800 transition hover:bg-neutral-50">
          Sorted by name
        </button>

        <button className="h-10 rounded-[12px] border border-neutral-300 bg-white px-4 text-[14px] text-neutral-800 transition hover:bg-neutral-50">
          Filter
        </button>

        <button className="flex h-10 w-10 items-center justify-center rounded-[12px] border border-neutral-300 bg-white text-[15px] text-neutral-700 transition hover:bg-neutral-50">
          ▦
        </button>

        <button className="flex h-10 w-10 items-center justify-center rounded-[12px] border border-neutral-300 bg-white text-[15px] text-neutral-700 transition hover:bg-neutral-50">
          ☰
        </button>
      </div>
    </div>
  );
}

/* ---------- Project grid ---------- */
function ProjectsGrid(props: {
  projects: Project[];
  deletingProjectId: string | null;
  openMenuProjectId: string | null;
  onOpenMenu: (projectId: string | null) => void;
  onDeleteProject: (projectId: string) => void;
}) {
  return (
    <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {props.projects.map((p) => (
        <ProjectCard
          key={p.id}
          project={p}
          isDeleting={props.deletingProjectId === p.id}
          menuOpen={props.openMenuProjectId === p.id}
          onToggleMenu={() =>
            props.onOpenMenu(props.openMenuProjectId === p.id ? null : p.id)
          }
          onCloseMenu={() => props.onOpenMenu(null)}
          onDelete={() => props.onDeleteProject(p.id)}
        />
      ))}
    </div>
  );
}

/* ---------- Single square project tile ---------- */
function ProjectCard(props: {
  project: Project;
  isDeleting: boolean;
  menuOpen: boolean;
  onToggleMenu: () => void;
  onCloseMenu: () => void;
  onDelete: () => void;
}) {
  const { project, isDeleting, menuOpen, onToggleMenu, onCloseMenu, onDelete } = props;

  return (
    <div className="group relative aspect-square overflow-hidden rounded-[18px] border border-neutral-200 bg-white transition hover:shadow-sm">
      {/* Tile action trigger */}
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onToggleMenu();
        }}
        className="absolute right-3 top-3 z-10 hidden rounded-lg bg-white/95 px-2.5 py-0.5 text-sm text-neutral-700 shadow-sm ring-1 ring-neutral-200 group-hover:block"
      >
        ⋮
      </button>

      {/* Tile action menu */}
      {menuOpen && (
        <div className="absolute right-3 top-10 z-20 w-40 rounded-xl border border-neutral-200 bg-white p-1 shadow-lg">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onCloseMenu();
              onDelete();
            }}
            disabled={isDeleting}
            className="block w-full rounded-lg px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            {isDeleting ? 'Deleting...' : 'Delete project'}
          </button>
        </div>
      )}

      {/* Tile content */}
      <a href={`/projects/${project.id}`} className="flex h-full flex-col">
        <CoverThumb url={project.cover_thumb_url ?? null} />

        <div className="flex flex-1 flex-col px-4 py-3">
          <div className="line-clamp-2 text-[16px] font-semibold leading-5 text-neutral-900">
            {project.title || 'Untitled Project'}
          </div>

          <div className="mt-1 text-[12px] text-neutral-500">
            {project.location || 'No location'}
          </div>

          <div className="mt-2 line-clamp-3 text-[13px] leading-5 text-neutral-700">
            {project.description || 'No description yet'}
          </div>
        </div>
      </a>
    </div>
  );
}

/* ---------- Tile image section ---------- */
function CoverThumb({ url }: { url: string | null }) {
  if (url) {
    return (
      <div className="h-[58%] w-full overflow-hidden">
        <img
          src={url}
          alt="cover"
          className="h-full w-full object-cover"
        />
      </div>
    );
  }

  return (
    <div className="flex h-[58%] w-full items-center justify-center bg-neutral-100 text-sm text-neutral-500">
      No cover
    </div>
  );
}

/* ---------- Empty state ---------- */
function EmptyState({ onClickCreate }: { onClickCreate: () => void }) {
  return (
    <div className="rounded-[18px] border border-dashed border-neutral-300 bg-white px-8 py-16 text-center">
      <div className="text-lg font-semibold text-neutral-900">
        No projects yet
      </div>
      <div className="mt-3 text-sm text-neutral-600">
        Create your first project to start uploading assets.
      </div>
      <button
        onClick={onClickCreate}
        className="mt-6 h-10 rounded-[12px] bg-black px-5 text-sm font-medium text-white hover:opacity-90"
      >
        Create your first project
      </button>
    </div>
  );
}

/* ---------- Loading skeleton ---------- */
function ProjectsSkeleton() {
  return (
    <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="aspect-square overflow-hidden rounded-[18px] border border-neutral-200 bg-white"
        >
          <div className="h-[58%] animate-pulse bg-neutral-200" />
          <div className="space-y-2 p-4">
            <div className="h-4 w-3/4 animate-pulse rounded bg-neutral-200" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-neutral-200" />
            <div className="h-3 w-full animate-pulse rounded bg-neutral-200" />
            <div className="h-3 w-5/6 animate-pulse rounded bg-neutral-200" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------- Error state ---------- */
function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-[18px] border border-red-200 bg-white p-6">
      <div className="text-sm font-semibold text-red-700">
        Failed to load projects
      </div>
      <div className="mt-2 text-sm text-neutral-700">{message}</div>
      <button
        onClick={onRetry}
        className="mt-4 h-10 rounded-[12px] border border-neutral-300 bg-white px-4 text-sm hover:bg-neutral-50"
      >
        Retry
      </button>
    </div>
  );
}

/* ---------- Simple modal ---------- */
function Modal(props: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-xl rounded-[22px] bg-white shadow-xl">
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