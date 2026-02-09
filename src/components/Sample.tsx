"use client";

import { useMemo, useRef, useState } from "react";
import { createClient } from "@/utils/supabase/client";

type PendingFile = {
  id: string;
  file: File;
  selected: boolean;
};

function formatBytes(bytes: number) {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(i === 0 ? 0 : 2)} ${units[i]}`;
}

function isImageFile(name: string) {
  const s = name.toLowerCase();
  return s.endsWith(".png") || s.endsWith(".jpg") || s.endsWith(".jpeg") || s.endsWith(".webp") || s.endsWith(".gif");
}

function safeName(name: string) {
  // Keep it simple and URL-safe enough for storage paths
  return name.replace(/[^\w.\-]+/g, "_");
}

export default function UploadAssetsModal({
  open,
  onClose,
  projectId,
  onUploaded,
}: {
  open: boolean;
  onClose: () => void;
  projectId: string;
  onUploaded?: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [pending, setPending] = useState<PendingFile[]>([]);
  const [notes, setNotes] = useState(""); // optional: apply same notes to all uploaded files
  const [submitting, setSubmitting] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [progressText, setProgressText] = useState<string | null>(null);

  // TODO: change this to your real bucket name
  const BUCKET = "designbase-assets";

  const supabase = createClient();


  const selectedCount = useMemo(() => pending.filter((p) => p.selected).length, [pending]);

  if (!open) return null;

  function handleAddClick() {
    fileInputRef.current?.click();
  }

  function handleFilesChosen(files: FileList | null) {
    if (!files || files.length === 0) return;

    const next: PendingFile[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files.item(i);
      if (!f) continue;
      next.push({
        id: crypto.randomUUID(),
        file: f,
        selected: false,
      });
    }

    setPending((prev) => [...prev, ...next]);
  }

  function toggleSelected(id: string) {
    setPending((prev) =>
      prev.map((p) => (p.id === id ? { ...p, selected: !p.selected } : p))
    );
  }

  function removeSelected() {
    setPending((prev) => prev.filter((p) => !p.selected));
  }

  async function submit() {
    if (pending.length === 0) {
      setErrMsg("No files to upload.");
      return;
    }

    setSubmitting(true);
    setErrMsg(null);
    setProgressText(null);

    try {
      for (let i = 0; i < pending.length; i++) {
        const item = pending[i];
        const f = item.file;

        setProgressText(`Uploading ${i + 1}/${pending.length}: ${f.name}`);

        // storage path design: projectId/YYYYMMDD_uuid_filename
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, "0");
        const d = String(now.getDate()).padStart(2, "0");
        const stamp = `${y}${m}${d}`;

        const fileKey = `${projectId}/${stamp}_${crypto.randomUUID()}_${safeName(f.name)}`;

        // 1) upload to storage
        const up = await supabase.storage.from(BUCKET).upload(fileKey, f, {
          upsert: false,
          cacheControl: "3600",
        });
        if (up.error) throw up.error;

        // 2) compute thumb_url (only if image + public bucket)
        let thumb_url: string | null = null;
        if (isImageFile(f.name)) {
          const { data } = supabase.storage.from(BUCKET).getPublicUrl(fileKey);
          thumb_url = data?.publicUrl ?? null;
        }

        // 3) insert db record
        const ins = await supabase.from("assets").insert({
          project_id: projectId,
          file_name: f.name,
          storage_path: fileKey,
          file_size: f.size,
          uploaded_at: new Date().toISOString(),
          notes: notes.trim() ? notes.trim() : null,
          thumb_url,
        });
        if (ins.error) throw ins.error;
      }

      setProgressText(null);
      setPending([]);
      setNotes("");

      onUploaded?.();
      onClose();
    } catch (e: any) {
      setErrMsg(e?.message ?? "Upload failed");
    } finally {
      setSubmitting(false);
      setProgressText(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-3xl rounded-2xl bg-background shadow-lg border">
        {/* Header */}
        <div className="flex items-center justify-between border-b p-4">
          <div className="text-lg font-semibold">Upload Project Assets</div>
          <button
            className="rounded-lg border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50"
            onClick={onClose}
            disabled={submitting}
          >
            Close
          </button>
        </div>

        {/* Body */}
        <div className="p-4">
          {errMsg && (
            <div className="mb-3 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">
              {errMsg}
            </div>
          )}

          {progressText && (
            <div className="mb-3 rounded-lg border p-3 text-sm text-muted-foreground">
              {progressText}
            </div>
          )}

          {/* Notes (optional) */}
          <div className="mb-4">
            <div className="text-sm font-medium">Notes (apply to all)</div>
            <textarea
              className="mt-2 w-full rounded-lg border bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes..."
              disabled={submitting}
            />
          </div>

          {/* Pending list */}
          <div className="rounded-2xl border overflow-hidden">
            <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-2">
              <div className="text-sm font-medium">
                Files to upload <span className="text-muted-foreground">({pending.length})</span>
              </div>
              {selectedCount > 0 && (
                <div className="text-xs text-muted-foreground">{selectedCount} selected</div>
              )}
            </div>

            {pending.length === 0 ? (
              <div className="p-6 text-sm text-muted-foreground">
                No files added yet. Click <span className="font-medium">Add</span> to select files.
              </div>
            ) : (
              <div className="divide-y">
                {pending.map((p) => (
                  <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={p.selected}
                      onChange={() => toggleSelected(p.id)}
                      disabled={submitting}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{p.file.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatBytes(p.file.size)}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {isImageFile(p.file.name) ? "image" : "file"}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => handleFilesChosen(e.target.files)}
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t p-4">
          <div className="flex gap-2">
            <button
              className="rounded-lg border px-4 py-2 text-sm hover:bg-muted disabled:opacity-50"
              onClick={handleAddClick}
              disabled={submitting}
            >
              Add
            </button>
            <button
              className="rounded-lg border px-4 py-2 text-sm hover:bg-muted disabled:opacity-50"
              onClick={removeSelected}
              disabled={submitting || selectedCount === 0}
            >
              Remove
            </button>
          </div>

          <button
            className="rounded-lg bg-foreground px-4 py-2 text-sm text-background hover:opacity-90 disabled:opacity-50"
            onClick={submit}
            disabled={submitting || pending.length === 0}
          >
            {submitting ? "Submitting..." : "Submit"}
          </button>
        </div>
      </div>
    </div>
  );
}
