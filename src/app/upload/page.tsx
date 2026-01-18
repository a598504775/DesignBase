"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

import { createClient } from "@/utils/supabase/client";

const BUCKET = "designbase-assets";

function buildProjectCoverPath(params: { projectId: string; file: File }) {
  const { projectId, file } = params;

  const safeName = file.name
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "");

  return `projects/${projectId}/cover/${safeName}`;
}

export default function UploadPage() {
  const router = useRouter();
  const supabase = createClient();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState(""); // 你表里叫 status
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!imageFile) return alert("Please upload an image");

    setSubmitting(true);

    try {
      // 1) 先创建 project 拿到 projectId
      // 如果你还没给 created_at 加 default now()，就需要手动传 created_at
      const { data: inserted, error: insertErr } = await supabase
        .from("projects")
        .insert([
          {
            title,
            description,
            status: status || null,
          },
        ])
        .select("id")
        .single();

      if (insertErr) throw insertErr;
      const projectId = inserted.id as string;

      // 2) 上传封面图到标准路径
      const path = buildProjectCoverPath({ projectId, file: imageFile });

      const { error: uploadErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, imageFile, {
          upsert: false,
          contentType: imageFile.type,
        });

      if (uploadErr) throw uploadErr;

      // 3) 生成 public URL
      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
      const coverUrl = urlData.publicUrl;

      // 4) 回写 projects.cover_image_url
      const { error: updateErr } = await supabase
        .from("projects")
        .update({ cover_image_url: coverUrl })
        .eq("id", projectId);

      if (updateErr) throw updateErr;

      // 5) 跳到详情页验证闭环
      router.push(`/projects/${projectId}`);
    } catch (err: any) {
      console.error(err);
      alert(err?.message ?? "Upload failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Upload New Project</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label>Project Title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>

        <div>
          <Label>Description</Label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
          />
        </div>

        <div>
          <Label>Status</Label>
          <Select onValueChange={setStatus}>
            <SelectTrigger>
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Concept">Concept</SelectItem>
              <SelectItem value="Schematic">Schematic</SelectItem>
              <SelectItem value="Development">Development</SelectItem>
              <SelectItem value="Construction">Construction</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Upload Cover Image</Label>
          <Input
            type="file"
            accept="image/*"
            onChange={(e) => setImageFile(e.target.files?.[0] || null)}
          />
          <div className="mt-1 text-xs text-muted-foreground">
            Storage path: {BUCKET}/projects/&lt;projectId&gt;/cover/&lt;filename&gt;
          </div>
        </div>

        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? "Submitting..." : "Submit"}
        </Button>
      </form>
    </div>
  );
}
