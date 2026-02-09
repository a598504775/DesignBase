"use client"

import { useMemo, useState, useRef, InputHTMLAttributes } from "react";
import { createClient } from "@/utils/supabase/client";

type Props = {
    open : boolean,
    onClose : () => void,
    projectId : string,
    onUpdated? : () => void;
}

function safeName(name: string): string {
    return name.replace(/[^\w.\-]+/g, "_");
}

function isImage(name: string): boolean {
    const s = name.toLowerCase();
    return s.endsWith(".png") || s.endsWith(".jpg") || s.endsWith(".jpeg") || s.endsWith(".webp") || s.endsWith(".gif");
}

function formatBytes(bytes: number): string {
    const units = ["B", "KB", "MB", "GB", "TB"];
    let v = bytes;
    let index = 0;
    while (v > 1024 && index < units.length - 1) {
        v = v / 1024;
        index ++;
    }
    return `${v.toFixed(index === 0 ? 0 : 2)} ${units[index]}`;
}

export default function UploadAssetsModal ({open, onClose, projectId, onUpdated} : Props) {

    type PendingFile = {
        id : string,
        f : File,
        selected : boolean;
    }

    if (!open) return null;

    const [submitting, setSubmitting] = useState(false);
    const fileInputHtml = useRef<HTMLInputElement | null>(null);
    const [pending, setPending] = useState<PendingFile[]>([]);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [progressText, setProgreeText] = useState<string | null>(null);
    const fileCount = useMemo(() => {return pending.length},[pending])

    const BUCKET = "designbase-assets";
    const supabase = createClient();

    function onClickAdd() {
        fileInputHtml.current?.click()
    }

    function removeSelected() {
        setPending((prev) => prev.filter((p) => !p.selected));
    }

    function handleFilesChosen(files : FileList | null) {
        if (!files) return null;
        const next : PendingFile[] = [];

        for (let i = 0; i < files.length; i ++) {
            const file = files.item(i);
            if (file) {
                next.push({
                    id : crypto.randomUUID(),
                    f : file,
                    selected : false
                })
            }
        }
        setPending((prev) => [...prev, ...next]);
    }

    function toggleSelected(id : string) {
        setPending((prev) => 
            prev.map((p) => 
                {return (p.id === id ? {...p, selected : !p.selected} : p)}
            )
        );
    }

    async function submit() {
        if (pending.length === 0) {
            setErrorMsg("No files to upload.");
            return;
        }

        setSubmitting(true);
        setErrorMsg(null);
        setProgreeText(null);
        try {
            for (let i = 0; i < pending.length; i ++) {
                const item = pending[i];
                const f = item.f;
                const now = new Date();
                const year = now.getFullYear();
                const month = String(now.getMonth() + 1).padStart(2, "0");
                const day = String(now.getDate()).padStart(2, "0");
                const date = `${year}-${month}-${day}`;

                const fileKey = `${projectId}/${date}_${crypto.randomUUID()}_${safeName(f.name)}`;

                const up = await supabase.storage.from(BUCKET).upload(fileKey, f, {upsert: false, cacheControl: "3600",});

                if (up.error) throw(up.error);

                // 2) compute thumb_url (only if image + public bucket)
                let thumb_url: string | null = null;
                if (isImage(f.name)) {
                    const { data } = supabase.storage.from(BUCKET).getPublicUrl(fileKey);
                    thumb_url = data?.publicUrl ?? null;
                }

                const ins = await supabase.from("assets").insert({
                    project_id: projectId,
                    file_name: safeName(f.name),
                    storage_path: fileKey,
                    file_size: f.size,
                    thumb_url,
                    owner_id: "00000000-0000-0000-0000-000000000001",
                    uploaded_at: new Date().toISOString(),
                });

                if (ins.error) throw ins.error;
            }
            setProgreeText(null);
            setPending([]);
            setErrorMsg(null);
        }
        catch (e: any){
            setErrorMsg(e?.message ?? "Upload faild");
        }
        finally {
            setSubmitting(false);
            setProgreeText(null);
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-lg border flex flex-col space-y-2">

                {/* Header */}
                <div className="flex items-center justify-between">
                    <span className="text-lg font-semibold">Upload List</span>
                    <button 
                    className="border rounded-xl px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50"
                    onClick={onClose}
                    disabled={submitting}
                    >
                        ✕
                    </button>
                </div>

                {/* Body */}
                <div className="rounded-2xl border overflow-hidden">
                    {pending?.length === 0 ? 
                        (<div className="p-6 text-sm text-muted-foreground">No files added yet. Click <span className="font-medium">“Add”</span> to select files.</div>) : (
                            pending.map((p) => {
                                return (
                                    <div className="flex items-center gap-3 px-4 py-3">
                                        <input type="checkbox" checked={p.selected} disabled={submitting} onChange={() => toggleSelected(p.id)}/>
                                        <div className="min-w-0 flex-1">
                                            <div className="truncate text-sm font-medium">
                                                {p.f.name}
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                                {formatBytes(p.f.size)}
                                            </div>
                                        </div>
                                    </div>
                                )
                            })
                        )
                    }
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <button
                        className="rounded-lg border px-4 py-2 text-sm hover:bg-muted disabled:opacity-50"
                        onClick={onClickAdd}  
                        disabled={submitting}
                        >
                            Add
                        </button>
                        <button
                            className="rounded-lg border px-4 py-2 text-sm hover:bg-muted disabled:opacity-50"
                            onClick={removeSelected}
                            disabled={submitting}
                        >
                            Remove
                        </button>
                    </div>
                    <button
                        className="rounded-lg bg-foreground px-4 py-2 text-sm text-background hover:opacity-90 disabled:opacity-50"
                        onClick={submit}
                        disabled={submitting}
                    >
                        {submitting ? "Submitting..." : "Submit"}
                    </button>
                </div>

                {/* Mesage */}
                <div className="py-2 border rounded-xl">
                    {errorMsg && 
                        <div className="mb-3 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">{errorMsg}</div>
                    }
                    {progressText && 
                        <div className="mb-3 rounded-lg border p-3 text-sm text-muted-foreground">{progressText}</div>
                    }
                </div>

                {/* Hidden input */}
                <input
                ref={fileInputHtml}
                type="file"
                className="hidden"
                onChange={(e) => handleFilesChosen(e.target.files)}
                >
                </input>
            </div>
        </div>
    )
}