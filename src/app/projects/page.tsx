'use client';

import { useEffect, useMemo, useState } from 'react';
import { ProjectCreateForm } from '@/components/ProjectCreateForm';
import { createClient } from '@/utils/supabase/client';
import { ContentUnitSearchRow, searchContentUnits } from '@/lib/searchContentUnits'
import Link from "next/link";
import { AssetSearchRow, searchAssets } from '@/lib/searchAssets';

import { SearchBarSection } from "@/components/search/SearchBarSection";
import { FilterPanel } from "@/components/search/FilterPanel";

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
type SearchTab = "projects" | "assets" | "contents";

export default function ProjectsPage() {
  const supabase = useMemo(() => createClient(), []);

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

  // Content level search related states
  const [searchTab, setSearchTab] = useState<SearchTab>("projects");
  const [contentResults, setContentResults] = useState<ContentUnitSearchRow[]>([]);
  const [searchingContents, setSearchingContents] = useState(false);

  // Display all projects or search results
  const hasQuery = query.trim().length > 0;

  // Display asset search results
  const [assetResults, setAssetResults] = useState<AssetSearchRow[]>([]);
  const [searchingAssets, setSearchingAssets] = useState(false);

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

  // Search function: Project level
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


  // Search function: Asset level
  useEffect(() => {
    if (searchTab !== "assets" || !query.trim()) {
      setSearchingAssets(false);
      return;
    }

    let cancelled = false;

    async function run() {
      try {
        setSearchingAssets(true);

        const rows = await searchAssets({
          supabase,
          query,
        });

        if (!cancelled) {
          setAssetResults(rows);
        }
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          setAssetResults([]);
        }
      } finally {
        if (!cancelled) {
          setSearchingAssets(false);
        }
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [searchTab, query, supabase]);


  // Search function: Content level
  const trimmedQuery = query.trim();

  useEffect(() => {
    if (searchTab !== "contents" || !trimmedQuery) {
      setSearchingContents(false);
      return;
    }

    let cancelled = false;

    async function runContentSearch() {
      try {
        setSearchingContents(true);

        const rows = await searchContentUnits({
          supabase,
          query: trimmedQuery,
          limit: 24,
        });

        if (!cancelled) {
          setContentResults(rows);
        }
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          setContentResults([]);
        }
      } finally {
        if (!cancelled) {
          setSearchingContents(false);
        }
      }
    }

    runContentSearch();

    return () => {
      cancelled = true;
    };
  }, [searchTab, trimmedQuery, supabase]);

  //Group asset results

  const groupedAssetResults = useMemo(() => {
    const projectMap = new Map<
      string,
      {
        projectId: string;
        projectTitle: string;
        rows: AssetSearchRow[];
      }
    >();

    for (const row of assetResults) {
      const projectId = row.project_id;
      const projectTitle = row.project_title ?? "Untitled Project";

      if (!projectMap.has(projectId)) {
        projectMap.set(projectId, {
          projectId,
          projectTitle,
          rows: [],
        });
      }

      projectMap.get(projectId)!.rows.push(row);
    }

    return Array.from(projectMap.values()).sort((a, b) =>
      a.projectTitle.localeCompare(b.projectTitle)
    );
  }, [assetResults]);

  // Group content results
  const groupedContentResults = useMemo(() => {
    const projectMap = new Map<
      string,
      {
        projectId: string;
        projectTitle: string;
        assets: Map<
          string,
          {
            assetId: string;
            assetFileName: string;
            rows: ContentUnitSearchRow[];
          }
        >;
      }
    >();

    for (const row of contentResults) {
      const projectId = row.project_id;
      const projectTitle = row.project_title ?? "Untitled Project";
      const assetId = row.asset_id;
      const assetFileName = row.asset_file_name ?? "Untitled File";

      if (!projectMap.has(projectId)) {
        projectMap.set(projectId, {
          projectId,
          projectTitle,
          assets: new Map(),
        });
      }

      const projectGroup = projectMap.get(projectId)!;

      if (!projectGroup.assets.has(assetId)) {
        projectGroup.assets.set(assetId, {
          assetId,
          assetFileName,
          rows: [],
        });
      }

      projectGroup.assets.get(assetId)!.rows.push(row);
    }

    return Array.from(projectMap.values()).map((projectGroup) => ({
      projectId: projectGroup.projectId,
      projectTitle: projectGroup.projectTitle,
      assets: Array.from(projectGroup.assets.values()).map((assetGroup) => ({
        assetId: assetGroup.assetId,
        assetFileName: assetGroup.assetFileName,
        rows: assetGroup.rows.sort((a, b) => a.unit_index - b.unit_index),
      })),
    }));
  }, [contentResults]);

  // Insert a newly created project into the current list
  function handleCreated(newProject: Project) {
    setProjects((prev) => [newProject, ...prev]);
    setIsCreateOpen(false);
  }

  function getResultsTitle() {
    if (!hasQuery) return "Projects";

    if (searchTab === "projects") {
      return `${filtered.length} Projects Found`;
    }

    if (searchTab === "assets") {
      return `${assetResults.length} Assets Found`;
    }

    return `${contentResults.length} Contents Found`;
  }

  function renderRightControls() {
    if (!hasQuery) {
      return (
        <>
          <SortButton />
          <IconButton ariaLabel="Tile view">▦</IconButton>
          <IconButton ariaLabel="List view">☰</IconButton>
          <button
            onClick={() => setIsCreateOpen(true)}
            className="flex h-9 items-center justify-center rounded-[4px] border border-[#66BF86] bg-[#91E0B0] px-4.5 text-[18px] font-medium text-black hover:bg-[#66BF86]"
          >
            new project
          </button>
        </>
      );
    }

    return <SortButton />;
  }  

  function renderResultsContent() {
    if (!hasQuery) {
      return (
        <>
          {loadState === "loading" && <ProjectsSkeleton />}

          {loadState === "error" && (
            <ErrorState
              message={errorMsg}
              onRetry={() => window.location.reload()}
            />
          )}

          {loadState === "ready" && projects.length === 0 && (
            <EmptyState onClickCreate={() => setIsCreateOpen(true)} />
          )}

          {loadState === "ready" && projects.length > 0 && (
            <ProjectsGrid
              projects={projects}
              deletingProjectId={deletingProjectId}
              openMenuProjectId={openMenuProjectId}
              onOpenMenu={setOpenMenuProjectId}
              onDeleteProject={handleDeleteProject}
            />
          )}
        </>
      );
    }

    if (searchTab === "projects") {
      return (
        <>
          {loadState === "loading" && <ProjectsSkeleton />}

          {loadState === "error" && (
            <ErrorState
              message={errorMsg}
              onRetry={() => window.location.reload()}
            />
          )}

          {loadState === "ready" && filtered.length === 0 && (
            <NoResultsState />
          )}

          {loadState === "ready" && filtered.length > 0 && (
            <ProjectsGrid
              projects={filtered}
              deletingProjectId={deletingProjectId}
              openMenuProjectId={openMenuProjectId}
              onOpenMenu={setOpenMenuProjectId}
              onDeleteProject={handleDeleteProject}
            />
          )}
        </>
      );
    }

    if (searchTab === "assets") {
      return (
        <AssetResults
          groups={groupedAssetResults}
          loading={searchingAssets}
        />
      );
    }

    return (
      <ContentResults
        groups={groupedContentResults}
        loading={searchingContents}
      />
    );
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
    <div className="flex h-screen flex-col overflow-hidden bg-[#F5F5F5]">
      <PageTopBar />

      <main className="flex min-h-0 flex-1 flex-col px-9 pb-9">
        <div>
          <SearchBarSection
            searchTab={searchTab}
            query={query}
            onTabChange={setSearchTab}
            onQueryChange={setQuery}
            onClear={() => setQuery("")}
            onCopy={() => {
              navigator.clipboard.writeText(query);
            }}
          />
        </div>

        <section className="mt-4.5 flex min-h-0 flex-1 gap-4.5">
          <div className="h-full w-[288px] shrink-0">
            <FilterPanel searchTab={searchTab} />
          </div>

          <ResultsShell
            title={getResultsTitle()}
            isSearching={hasQuery}
            rightControls={renderRightControls()}
          >
            {renderResultsContent()}
          </ResultsShell>
        </section>

        {isCreateOpen && (
          <Modal title="Create Project" onClose={() => setIsCreateOpen(false)}>
            <ProjectCreateForm
              onCreated={handleCreated}
              onCancel={() => setIsCreateOpen(false)}
            />
          </Modal>
        )}
      </main>

      <BottomBar />
    </div>
  );
}

/* ---------- Thin full-width top bar ---------- */
function PageTopBar() {
  return (
    <header className="w-full bg-black">
      <div className="flex h-9 w-full items-center justify-between px-9">
        <div className="flex items-center gap-4">
          <div className="h-3 w-3 bg-[#91E0B0]" />
          <div className="text-[16px] font-medium text-white">
            Sample design base
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-[16px] text-white">Admin</div>
          <div className="h-8 w-8 rounded-full bg-[#91E0B0]" />
        </div>
      </div>
    </header>
  );
}

/* ---------- Thin full-width bottom bar ---------- */
function BottomBar() {
  return (
    <footer className="h-4.5 shrink-0 bg-[#66BF86]">
      <div className="flex h-full w-full items-center justify-end px-9 text-[12px] leading-none text-white">
        <span>Version</span>
        <span className="mx-2 h-4 w-px bg-white/70" />
        <span>Term of use</span>
        <span className="mx-2 h-4 w-px bg-white/70" />
        <span>About</span>
      </div>
    </footer>
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
    <div className="grid grid-cols-[repeat(auto-fill,336px)] gap-x-4.5 gap-y-4.5">
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
    <div className="group relative h-[336px] w-[336px] overflow-hidden rounded-[4px] border border-[#D9D9D9] bg-white transition hover:bg-[#F5F5F5]">
      {/* Tile action trigger */}
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onToggleMenu();
        }}
        className="absolute right-2 top-2 z-20 w-9 rounded-[4px] border border-[#D9D9D9] bg-white p-1"
      >
        ⋮
      </button>

      {/* Tile action menu */}
      {menuOpen && (
        <div className="absolute right-2 top-2 z-20 w-40 rounded-[4px] border border-neutral-200 bg-white p-1 shadow-lg">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onCloseMenu();
              onDelete();
            }}
            disabled={isDeleting}
            className="block w-full rounded-[4px] px-2 py-2 text-left text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            {isDeleting ? 'Deleting...' : 'Delete project'}
          </button>
        </div>
      )}

      {/* Tile content */}
      <Link href={`/projects/${project.id}`} className="flex h-full flex-col">
        <CoverThumb url={project.cover_thumb_url ?? null} />

        <div className="flex flex-1 flex-col px-4 py-3">
          <div className="line-clamp-2 text-[16px] font-semibold leading-5 text-black">
            {project.title || 'Untitled Project'}
          </div>

          <div className="mt-1 text-[12px] leading-5 text-[#8E8E93]">
            {project.location || 'No location'}
          </div>

          <div className="mt-3 line-clamp-4 text-[12px] leading-5 text-black">
            {project.description || 'No description yet'}
          </div>
        </div>
      </Link>
    </div>
  );
}

/* ---------- Tile image section ---------- */
function CoverThumb({ url }: { url: string | null }) {
  if (url) {
    return (
      <div className="h-[192px] w-full overflow-hidden bg-[#D9D9D9]">
        <img
          src={url}
          alt="cover"
          className="h-full w-full object-cover"
        />
      </div>
    );
  }

  return (
    <div className="flex h-[192px] w-full items-center justify-center bg-[#D9D9D9] text-[16px] text-[#8E8E93]">
      No cover
    </div>
  );
}

/* ---------- Empty state ---------- */
function EmptyState({ onClickCreate }: { onClickCreate: () => void }) {
  return (
    <div className="rounded-[4px] border border-dashed border-neutral-300 bg-white px-8 py-16 text-center">
      <div className="text-[16px] font-semibold text-neutral-900">
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

// No result state
function NoResultsState() {
  return (
    <div className="rounded-[4px] border border-neutral-200 bg-white px-8 py-16 text-center">
      <div className="text-[16px] font-semibold text-neutral-900">
        No matching projects
      </div>
      <div className="mt-3 text-[12px] text-neutral-600">
        Try a different keyword.
      </div>
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
          <div className="text-[16px] font-semibold">{props.title}</div>
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

// Display search result, content level
function ContentResults(props: {
  groups: Array<{
    projectId: string;
    projectTitle: string;
    assets: Array<{
      assetId: string;
      assetFileName: string;
      rows: ContentUnitSearchRow[];
    }>;
  }>;
  loading: boolean;
}) {
  const [openProjects, setOpenProjects] = useState<Record<string, boolean>>({});

  function toggleProject(projectId: string) {
    setOpenProjects((prev) => ({
      ...prev,
      [projectId]: !(prev[projectId] ?? true),
    }));
  }

  if (props.loading) {
    return <ResultMessage>Searching...</ResultMessage>;
  }

  if (props.groups.length === 0) {
    return <ResultMessage>No content matched.</ResultMessage>;
  }

  return (
    <div className="space-y-6">
      {props.groups.map((projectGroup) => {
        const isProjectOpen = openProjects[projectGroup.projectId] ?? true;

        return (
          <section key={projectGroup.projectId}>
            <button
              type="button"
              onClick={() => toggleProject(projectGroup.projectId)}
              className="mb-3 flex h-8 items-center gap-2 text-left text-[16px] font-semibold text-black hover:text-[#66BF86]"
            >
              <span className="text-[16px] leading-none">
                {isProjectOpen ? "▾" : "▸"}
              </span>
              <span>{projectGroup.projectTitle}</span>
            </button>

            {isProjectOpen && (
              <div className="space-y-6">
                <div
                  className="
                    grid
                    grid-cols-[repeat(auto-fill,minmax(324px,1fr))]
                    gap-4.5
                  "
                >
                  {projectGroup.assets.flatMap((assetGroup) =>
                    assetGroup.rows.map((row) => (
                      <ContentResultCard key={row.id} row={row} />
                    ))
                  )}
                </div>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

function ContentResultCard({ row }: { row: ContentUnitSearchRow }) {
  const title =
    row.display_label ??
    row.display_title ??
    `Page ${row.unit_index}`;

  return (
    <div
      className="
        w-[324px]
        h-[108px]
        flex
        items-start
        gap-3
        rounded-[4px]
        border
        hover:bg-[#EDEDED]
      "
    >
      {/* preview */}
      <div className="w-[108px] h-full shrink-0 bg-[#D9D9D9]">
        {row.preview_url ? (
          <img
            src={row.preview_url}
            alt={title}
            className="h-full w-full object-cover rounded-[4px]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[12px] text-[#8E8E93]">
            Preview
          </div>
        )}
      </div>

      {/* text */}
      <div className="min-w-0 flex-1 p-3">
        <div className="truncate text-[14px] font-semibold text-black">
          {title}
        </div>

        <div className="truncate text-[12px] text-[#8E8E93]">
          {row.asset_file_name ?? "Unknown"}
        </div>

        <div className="mt-1 line-clamp-2 text-[12px] text-[#8E8E93]">
          {row.snippet ?? "No text snippet available."}
        </div>
      </div>
    </div>
  );
}

// Asset search result
function AssetResults(props: {
  groups: Array<{
    projectId: string;
    projectTitle: string;
    rows: AssetSearchRow[];
  }>;
  loading: boolean;
}) {
  const [openProjects, setOpenProjects] = useState<Record<string, boolean>>({});

  function toggleProject(projectId: string) {
    setOpenProjects((prev) => ({
      ...prev,
      [projectId]: !(prev[projectId] ?? true),
    }));
  }

  if (props.loading) {
    return <ResultMessage>Searching...</ResultMessage>;
  }

  if (props.groups.length === 0) {
    return <ResultMessage>No assets found.</ResultMessage>;
  }

  return (
    <div className="space-y-6">
      {props.groups.map((group) => {
        const isOpen = openProjects[group.projectId] ?? true;

        return (
          <section key={group.projectId}>
            <button
              type="button"
              onClick={() => toggleProject(group.projectId)}
              className="mb-3 flex h-8 items-center gap-2 text-left text-[16px] font-semibold text-black hover:text-[#66BF86]"
            >
              <span className="text-[16px] leading-none">
                {isOpen ? "▾" : "▸"}
              </span>
              <span>{group.projectTitle}</span>
            </button>

            {isOpen && (
              <div className="space-y-4">
                {group.rows.map((row) => (
                  <AssetResultRow key={row.id} row={row} />
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

function AssetResultRow({ row }: { row: AssetSearchRow }) {
  const summary =
    (row as any).ai_summary ||
    "No description available.";

  return (
    <div className="flex h-[108px] overflow-hidden rounded-[4px] border border-[#D9D9D9] bg-white hover:bg-[#F5F5F5]">
      <div className="h-[108px] w-[108px] shrink-0 bg-[#D9D9D9]">
        {row.thumb_url ? (
          <img
            src={row.thumb_url}
            alt={row.file_name ?? "asset preview"}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[14px] text-[#8E8E93]">
            Preview
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1 px-4 py-3">
        <div className="truncate text-[14px] font-semibold leading-5 text-black">
          {row.file_name ?? "Untitled asset"}
        </div>

        <div className="mt-0.5 text-[14px] leading-5 text-[#8E8E93]">
          {row.asset_type ?? "Unknown type"}
        </div>

        <div className="mt-2 line-clamp-2 text-[14px] leading-5 text-[#8E8E93]">
          Description: {summary}
        </div>
      </div>
    </div>
  );
}

function ResultMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[4px] border border-[#D9D9D9] bg-white px-4 py-4 text-[14px] text-[#8E8E93]">
      {children}
    </div>
  );
}

function ResultsShell(props: {
  title: string;
  isSearching: boolean;
  rightControls?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-[4px] border border-[#D9D9D9] bg-white">
      <div className="flex h-[72px] shrink-0 items-center justify-between px-9">
        <h1
          className={
            props.isSearching
              ? "text-[18px] font-bold leading-none text-[#66BF86]"
              : "text-[36px] font-bold leading-none text-black"
          }
        >
          {props.title}
        </h1>

        <div className="flex items-center gap-3">
          {props.rightControls}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-9 py-0 custom-scroll">
        {props.children}
      </div>
    </div>
  );
}

function SortButton() {
  return (
    <button
      type="button"
      className="flex h-9 items-center justify-center rounded-[4px] border border-[#8E8E93] bg-white px-5 text-[18px] text-black hover:bg-[#F5F5F5]"
    >
      ↓ name
    </button>
  );
}

function IconButton(props: {
  children: React.ReactNode;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      aria-label={props.ariaLabel}
      className="flex h-9 w-9 items-center justify-center rounded-[4px] border border-[#D9D9D9] bg-white text-[20px] text-black hover:bg-[#F5F5F5]"
    >
      {props.children}
    </button>
  );
}