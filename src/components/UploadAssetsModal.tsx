"use client";

import { useMemo, useRef, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import {
  ASSET_BUCKET,
  buildAssetStoragePath,
  uploadFileToStorage,
  createAssetRow,
  inferAssetType,
} from "@/lib/assets";
import { createImageContentUnit } from "@/lib/contentUnits";

type Props = {
  open: boolean;
  onClose: () => void;
  projectId: string;
  onUpdated?: () => void;
};

type PendingFile = {
  id: string;
  f: File;
  selected: boolean;
};

function isImage(name: string): boolean {
  const s = name.toLowerCase();
  return (
    s.endsWith(".png") ||
    s.endsWith(".jpg") ||
    s.endsWith(".jpeg") ||
    s.endsWith(".webp") ||
    s.endsWith(".gif")
  );
}

function formatBytes(bytes: number): string {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let v = bytes;
  let index = 0;

  while (v > 1024 && index < units.length - 1) {
    v = v / 1024;
    index++;
  }

  return `${v.toFixed(index === 0 ? 0 : 2)} ${units[index]}`;
}

export default function UploadAssetsModal({
  open,
  onClose,
  projectId,
  onUpdated,
}: Props) {
  const supabase = createClient();

  const [submitting, setSubmitting] = useState(false);
  const [pending, setPending] = useState<PendingFile[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [progressText, setProgressText] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const fileCount = useMemo(() => pending.length, [pending]);
  const selectedCount = useMemo(
    () => pending.filter((p) => p.selected).length,
    [pending]
  );

  if (!open) return null;

  function onClickAdd() {
    fileInputRef.current?.click();
  }

  function removeSelected() {
    setPending((prev) => prev.filter((p) => !p.selected));
  }

  function handleFilesChosen(files: FileList | null) {
    if (!files) return;

    const next: PendingFile[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files.item(i);
      if (file) {
        next.push({
          id: crypto.randomUUID(),
          f: file,
          selected: false,
        });
      }
    }

    setPending((prev) => [...prev, ...next]);
  }

  function toggleSelected(id: string) {
    setPending((prev) =>
      prev.map((p) => (p.id === id ? { ...p, selected: !p.selected } : p))
    );
  }

  async function submit() {
    if (pending.length === 0) {
      setErrorMsg("No files to upload.");
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    setProgressText(null);

    try {
      for (let i = 0; i < pending.length; i++) {
        const item = pending[i];
        const f = item.f;

        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, "0");
        const day = String(now.getDate()).padStart(2, "0");
        const date = `${year}-${month}-${day}`;

        setProgressText(`Uploading ${i + 1} of ${pending.length}: ${f.name}`);

        const storagePath = buildAssetStoragePath({
          projectId,
          fileName: `${date}_${crypto.randomUUID()}_${f.name}`,
          kind: "asset",
        });

        const uploaded = await uploadFileToStorage({
          supabase,
          bucket: ASSET_BUCKET,
          storagePath,
          file: f,
        });

        const assetRow = await createAssetRow({
          supabase,
          projectId,
          file: f,
          storagePath: uploaded.storagePath,
          thumbUrl: isImage(f.name) ? uploaded.publicUrl : null,
          assetType: inferAssetType(f.name),
        });

        if (assetRow.asset_type === "Image") {
            await createImageContentUnit({
                supabase,
                asset: assetRow
            })
        }

        if (assetRow.asset_type === "PDF") {
            fetch("/api/ingest/pdf", {
                method: "POST",
                headers: {
                "Content-Type": "application/json",
                },
                body: JSON.stringify({
                assetId: assetRow.id,
                projectId: assetRow.project_id,
                storagePath: assetRow.storage_path,
                }),
            }).catch((err) => {
                console.error("PDF ingestion failed:", err);
            });
        }
      }

      setProgressText(null);
      setPending([]);
      setErrorMsg(null);

      onUpdated?.();
      onClose();
    } catch (e: any) {
      console.error(e);
      setErrorMsg(e?.message ?? "Upload failed.");
    } finally {
      setSubmitting(false);
      setProgressText(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="flex w-full max-w-3xl flex-col overflow-hidden rounded-[22px] border border-neutral-200 bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4">
          <div>
            <div className="text-[18px] font-semibold tracking-tight text-neutral-950">
              Upload Project Assets
            </div>
            <div className="mt-1 text-sm text-neutral-500">
              Add files to the upload queue, then submit them together.
            </div>
          </div>

          <button
            className="rounded-[10px] px-2 py-1 text-sm text-neutral-500 hover:bg-neutral-100 disabled:opacity-50"
            onClick={onClose}
            disabled={submitting}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4 px-5 py-5">
          {/* Toolbar */}
          <div className="flex items-center justify-between">
            <div className="text-sm text-neutral-600">
              {fileCount} file{fileCount === 1 ? "" : "s"} in queue
              {selectedCount > 0 && ` · ${selectedCount} selected`}
            </div>

            <div className="flex items-center gap-2">
              <button
                className="h-10 rounded-[12px] border border-neutral-300 bg-white px-4 text-sm text-neutral-800 hover:bg-neutral-50 disabled:opacity-50"
                onClick={onClickAdd}
                disabled={submitting}
              >
                Add
              </button>

              <button
                className="h-10 rounded-[12px] border border-neutral-300 bg-white px-4 text-sm text-neutral-800 hover:bg-neutral-50 disabled:opacity-50"
                onClick={removeSelected}
                disabled={submitting || selectedCount === 0}
              >
                Remove
              </button>
            </div>
          </div>

          {/* Drop zone + file list */}
          <div
            className="overflow-hidden rounded-[16px] border border-dashed border-neutral-300 bg-neutral-50"
            onDrop={(e) => {
              e.preventDefault();
              handleFilesChosen(e.dataTransfer.files);
            }}
            onDragOver={(e) => e.preventDefault()}
          >
            {/* Empty state */}
            {pending.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <div className="text-sm font-medium text-neutral-700">
                  No files added yet
                </div>
                <div className="mt-2 text-sm text-neutral-500">
                  Click <span className="font-medium">Add</span> or drag files into this area.
                </div>
              </div>
            ) : (
              <div className="max-h-[360px] overflow-y-auto">
                {pending.map((p, index) => (
                  <div
                    key={p.id}
                    className={`flex items-center gap-3 px-4 py-3 ${
                      index !== pending.length - 1 ? "border-b border-neutral-200" : ""
                    }`}
                  >
                    <div className="flex w-5 shrink-0 items-center justify-center">
                      <input
                        type="checkbox"
                        checked={p.selected}
                        disabled={submitting}
                        onChange={() => toggleSelected(p.id)}
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-neutral-900">
                        {p.f.name}
                      </div>
                      <div className="mt-1 text-xs text-neutral-500">
                        {formatBytes(p.f.size)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Status messages */}
          {(errorMsg || progressText) && (
            <div className="space-y-2">
              {errorMsg && (
                <div className="rounded-[12px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {errorMsg}
                </div>
              )}

              {progressText && (
                <div className="rounded-[12px] border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
                  {progressText}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-neutral-200 px-5 py-4">
          <button
            className="h-10 rounded-[12px] border border-neutral-300 bg-white px-5 text-sm text-neutral-800 hover:bg-neutral-50 disabled:opacity-50"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </button>

          <button
            className="h-10 rounded-[12px] border border-[#69c98e] bg-[#8fdbab] px-5 text-sm font-medium text-black transition hover:brightness-95 disabled:opacity-50"
            onClick={submit}
            disabled={submitting || pending.length === 0}
          >
            {submitting ? "Submitting..." : "Upload Assets"}
          </button>
        </div>

        {/* Hidden input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => handleFilesChosen(e.target.files)}
        />
      </div>
    </div>
  );
}