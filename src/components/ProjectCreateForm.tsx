// src/components/ProjectCreateForm.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

export function ProjectCreateForm({ onCreated, onCancel }: any) {
  const router = useRouter();
  const supabase = createClient();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onCreate = async () => {
    if (!title.trim()) {
      setErr("Title is required.");
      return;
    }

    setLoading(true);
    setErr(null);

    const { error } = await supabase.from("projects").insert({
      title: title.trim(),
      description: description.trim() || null,
    });

    setLoading(false);

    if (error) {
      setErr(error.message);
      return;
    }

    setTitle("");
    setDescription("");
    router.refresh(); // 让 /projects 这个 Server Component 重新拉取列表
  };

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="font-medium">Create a project</div>

      <input
        className="w-full border rounded-md p-2"
        placeholder="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        disabled={loading}
      />

      <textarea
        className="w-full border rounded-md p-2"
        placeholder="Description (optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        disabled={loading}
        rows={3}
      />

      <div className="flex items-center gap-3">
        <button
          className="border rounded-md px-3 py-2"
          onClick={onCreate}
          disabled={loading}
        >
          {loading ? "Creating..." : "Create"}
        </button>

        {err && <span className="text-sm text-red-500">{err}</span>}
      </div>
    </div>
  );
}
