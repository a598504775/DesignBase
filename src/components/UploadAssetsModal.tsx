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
    return name.replace(/[^\w.\-]/g, "_");
}

function isImage(name: string): boolean {
    const s = name.toLowerCase();
    return s.endsWith(".png") || s.endsWith(".jpg") || s.endsWith(".jpeg") || s.endsWith(".webp") || s.endsWith(".gif");
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
    let fileList = FileList;

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
                const month = String(now.getMonth()).padStart(2, "0");
                const day = String(now.getDay()).padStart(2, "0");
                const date = `${year}-${month}-${day}`;

                const fileKey = `${projectId}/${date}_${crypto.randomUUID()}_${safeName(f.name)}`;

                const up = await supabase.storage.from("BUCKET").upload(fileKey, f, {upsert: false, cacheControl: "3600",});

                if (up.error) throw(up.error);


                

            }
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
            <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-lg">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <span>Upload List</span>
                    <button 
                    className="border rounded-xl px-2 bg-black text-white"
                    onClick={onClose}
                    >
                        x
                    </button>
                </div>
                {/* Body */}
                <div className="px-1 py-1 border text-sm ">
                    {pending?.length === 0 ? 
                        (<div>No files added yet</div>) :
                        (
                            pending.map((p) => {
                                return (
                                    <div className="flex items-center gap-2">
                                        <input type="checkbox" checked={p.selected} disabled={submitting} onChange={() => toggleSelected(p.id)}/>
                                        <div>{p.f.name}</div>
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
                        onClick={onClickAdd}  
                        >
                            Add
                        </button>
                        <button
                            onClick={removeSelected}
                        >
                            Remove
                        </button>
                    </div>
                    <button
                    >
                        Submit
                    </button>                    
                </div>
                {/* Mesage */}
                <div className="py-2">
                    {errorMsg && 
                        <div>{errorMsg}</div>
                    }
                    {progressText && 
                        <div>{progressText}</div>
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