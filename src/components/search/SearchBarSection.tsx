"use client";

type SearchTab = "projects" | "assets" | "contents";

type SearchBarSectionProps = {
  searchTab: SearchTab;
  query: string;
  onTabChange: (tab: SearchTab) => void;
  onQueryChange: (value: string) => void;
  onClear: () => void;
  onCopy?: () => void;
};

const TAB_LABELS: Record<SearchTab, string> = {
  projects: "Projects",
  assets: "Assets",
  contents: "Contents",
};

// Review this
export function SearchBarSection({
  searchTab,
  query,
  onTabChange,
  onQueryChange,
  onClear,
  onCopy,
}: SearchBarSectionProps) {
  return (
    <div className="space-y-3">
      <div className="text-[16px] leading-6 text-[#8E8E93]">
        Select the level of search function and start AI-powered searching
        experience
      </div>

      <div className="flex h-12 items-stretch overflow-hidden rounded-[4px] border border-[#D9D9D9] bg-white">
        {/* Left tabs */}
        <div className="flex shrink-0">
          <SearchTabButton
            label={TAB_LABELS.projects}
            active={searchTab === "projects"}
            onClick={() => onTabChange("projects")}
            isFirst
          />
          <SearchTabButton
            label={TAB_LABELS.assets}
            active={searchTab === "assets"}
            onClick={() => onTabChange("assets")}
          />
          <SearchTabButton
            label={TAB_LABELS.contents}
            active={searchTab === "contents"}
            onClick={() => onTabChange("contents")}
          />
        </div>

        {/* Search input */}
        <div className="flex min-w-0 flex-1 items-center border-l border-[#D9D9D9] px-4">
          <div className="mr-4 shrink-0 text-[18px] text-black">⌕</div>

          <input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder=""
            className="min-w-0 flex-1 border-0 bg-transparent text-[24px] leading-none text-black outline-none placeholder:text-[#8E8E93]"
          />
        </div>

        {/* Copy */}
        <button
          type="button"
          onClick={onCopy}
          className="flex w-12 shrink-0 items-center justify-center border-l border-[#D9D9D9] text-[20px] text-black transition hover:bg-[#F5F5F5]"
          aria-label="Copy"
        >
          ⧉
        </button>

        {/* Clear */}
        <button
          type="button"
          onClick={onClear}
          className="flex w-12 shrink-0 items-center justify-center border-l border-[#D9D9D9] text-[20px] text-black transition hover:bg-[#F5F5F5]"
          aria-label="Clear"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

function SearchTabButton(props: {
  label: string;
  active: boolean;
  onClick: () => void;
  isFirst?: boolean;
}) {
  const { label, active, onClick, isFirst = false } = props;

  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "flex h-12 min-w-[144px] items-center justify-center px-6 text-[24px] font-semibold transition",
        isFirst ? "" : "border-l border-[#D9D9D9]",
        active
          ? "bg-[#91E0B0] text-black"
          : "bg-white text-[#8E8E93] hover:bg-[#F5F5F5]",
      ].join(" ")}
    >
      {label}
    </button>
  );
}