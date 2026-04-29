"use client";

import { useMemo, useEffect, useState } from "react";

type SearchTab = "projects" | "assets" | "contents";

type FilterPanelProps = {
  searchTab: SearchTab;
};

type FilterSection = {
  id: string;
  label: string;
  defaultOpen?: boolean;
  content: React.ReactNode;
};

export function FilterPanel({ searchTab }: FilterPanelProps) {
  const sections = useMemo(() => {
    if (searchTab === "projects") {
      return getProjectSections();
    }

    if (searchTab === "assets") {
      return getAssetSections();
    }

    return getContentSections();
  }, [searchTab]);

  const initialOpenMap = useMemo(() => {
    const map: Record<string, boolean> = {};
    for (const section of sections) {
      map[section.id] = section.defaultOpen ?? false;
    }
    return map;
  }, [sections]);

  const [openMap, setOpenMap] = useState<Record<string, boolean>>(initialOpenMap);

  // reset open state when tab changes
  useEffect(() => {
    setOpenMap(initialOpenMap);
  }, [initialOpenMap]);

  function toggleSection(id: string) {
    setOpenMap((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  }

  return (
    <aside className="h-full w-full rounded-[4px] border border-[#D9D9D9] bg-white">
      <div className="flex h-18 items-center border-b border-[#D9D9D9] px-4">
        <div className="flex items-center gap-3 text-black">
          <span className="text-[24px] leading-none">Filters</span>
        </div>
      </div>

      <div>
        {sections.map((section) => {
          const isOpen = openMap[section.id] ?? false;

          return (
            <div key={section.id} className="border-b border-[#D9D9D9] last:border-b-0">
              <button
                type="button"
                onClick={() => toggleSection(section.id)}
                className="flex h-9 w-full items-center justify-between px-4 text-left hover:bg-[#F5F5F5]"
              >
                <span className="text-[16px] font-medium text-black">
                  {section.label}
                </span>
                <span className="text-[20px] text-black">{isOpen ? "−" : "+"}</span>
              </button>

              {isOpen && (
                <div className="px-4 pb-6 pt-2">
                  {section.content}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}

function getProjectSections(): FilterSection[] {
  return [
    {
      id: "category",
      label: "Category",
      defaultOpen: false,
      content: <PlaceholderCheckboxList items={["Residential", "Civic", "Office"]} />,
    },
    {
      id: "location",
      label: "Location",
      defaultOpen: true,
      content: (
        <div className="space-y-3">
          <SmallSearchInput />
          <PlaceholderCheckboxList items={["Los Angeles", "San Francisco", "Boca Raton"]} />
        </div>
      ),
    },
    {
      id: "status",
      label: "Status",
      defaultOpen: false,
      content: <PlaceholderCheckboxList items={["Concept", "Construction", "Completed"]} />,
    },
    {
      id: "year",
      label: "Year",
      defaultOpen: true,
      content: <MinMaxInputs />,
    },
  ];
}

function getAssetSections(): FilterSection[] {
  return [
    {
      id: "project",
      label: "Project",
      defaultOpen: false,
      content: <PlaceholderCheckboxList items={["The Rose Apartments", "Snowdon Towers", "Community Market"]} />,
    },
    {
      id: "fileType",
      label: "File Type",
      defaultOpen: true,
      content: (
        <div className="space-y-3">
          <SmallSearchInput />
          <PlaceholderCheckboxList items={["Image", "Document", "Presentation"]} />
        </div>
      ),
    },
    {
      id: "createdAt",
      label: "Created at",
      defaultOpen: false,
      content: <MinMaxInputs fromLabel="From" toLabel="To" />,
    },
    {
      id: "size",
      label: "Size",
      defaultOpen: true,
      content: <MinMaxInputs fromLabel="Min" toLabel="Max" />,
    },
  ];
}

function getContentSections(): FilterSection[] {
  return [
    {
      id: "project",
      label: "Project",
      defaultOpen: true,
      content: <PlaceholderCheckboxList items={["Project 1", "Project 12", "Project 28"]} />,
    },
    {
      id: "fileType",
      label: "File Type",
      defaultOpen: true,
      content: (
        <div className="space-y-3">
          <SmallSearchInput />
          <PlaceholderCheckboxList items={["Image", "Document", "Presentation"]} />
        </div>
      ),
    },
    {
      id: "createdAt",
      label: "Created at",
      defaultOpen: true,
      content: <MinMaxInputs fromLabel="From" toLabel="To" />,
    },
  ];
}

function SmallSearchInput() {
  return (
    <input
      placeholder="Search"
      className="h-10 w-full rounded-[4px] border border-[#8E8E93] bg-white px-3 text-[16px] text-black outline-none placeholder:text-[#8E8E93]"
    />
  );
}

function PlaceholderCheckboxList({ items }: { items: string[] }) {
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <label key={item} className="flex items-center gap-3 text-[16px] text-[#8E8E93]">
          <input type="checkbox" className="h-4 w-4 rounded-[2px] border-[#8E8E93]" />
          <span>{item}</span>
        </label>
      ))}
    </div>
  );
}

function MinMaxInputs(props?: { fromLabel?: string; toLabel?: string }) {
  const fromLabel = props?.fromLabel ?? "From";
  const toLabel = props?.toLabel ?? "To";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <span className="w-14 text-[16px] text-[#8E8E93]">{fromLabel}</span>
        <input className="h-8 w-[80px] rounded-[4px] border border-[#8E8E93] bg-white px-2 text-[16px] outline-none" />
      </div>

      <div className="flex items-center justify-between gap-3">
        <span className="w-14 text-[16px] text-[#8E8E93]">{toLabel}</span>
        <input className="h-8 w-[80px] rounded-[4px] border border-[#8E8E93] bg-white px-2 text-[16px] outline-none" />
      </div>
    </div>
  );
}