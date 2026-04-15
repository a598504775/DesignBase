"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/utils/supabase/client";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PROJECT_TYPES } from "@/lib/classifications";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { createImageContentUnit } from "@/lib/contentUnits"

import {
  ASSET_BUCKET,
  buildAssetStoragePath,
  uploadFileToStorage,
  removeFilesFromStorage,
  createAssetRow,
} from "@/lib/assets";

type ProjectListItem = {
  id: string;
  title: string | null;
  description: string | null;
  location: string | null;
  created_at?: string | null;
  cover_asset_id: string | null;
  cover_thumb_url: string | null;
  project_type: string | null;
};

type ProjectCreateFormProps = {
  onCreated?: (project: ProjectListItem) => void;
  onCancel?: () => void;
};

type InsertedProject = {
  id: string;
  title: string | null;
  description: string | null;
  location: string | null;
  created_at: string | null;
  cover_asset_id: string | null;
  project_type: string | null;
};

export function ProjectCreateForm({
  onCreated,
  onCancel,
}: ProjectCreateFormProps) {
  const router = useRouter();
  const supabase = createClient();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [projectType, setProjectType] = useState("");
  const [location, setLocation] = useState("");

  async function rollbackProject(projectId: string) {
    try {
      await supabase.from("projects").delete().eq("id", projectId);
    } catch {
      // Ignore rollback failure for now.
    }
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!title.trim()) {
      alert("Please enter a project title.");
      return;
    }

    if (!imageFile) {
      alert("Please upload a cover image.");
      return;
    }

    setSubmitting(true);

    let insertedProject: InsertedProject | null = null;
    let uploadedStoragePath: string | null = null;

    try {
      const { data: createdProject, error: createProjectError } = await supabase
        .from("projects")
        .insert([
          {
            title: title.trim(),
            description: description.trim() || null,
            status: status || null,
            project_type: projectType || null,
            location: location.trim() || null,
          },
        ])
        .select(
          "id, title, description, location, created_at, cover_asset_id, project_type"
        )
        .single();

      if (createProjectError) {
        throw createProjectError;
      }

      insertedProject = createdProject as InsertedProject;

      const storagePath = buildAssetStoragePath({
        projectId: insertedProject.id,
        fileName: imageFile.name,
        kind: "cover",
      });

      const uploaded = await uploadFileToStorage({
        supabase,
        bucket: ASSET_BUCKET,
        storagePath,
        file: imageFile,
      });

      uploadedStoragePath = uploaded.storagePath;

      const coverAsset = await createAssetRow({
        supabase,
        projectId: insertedProject.id,
        file: imageFile,
        storagePath: uploaded.storagePath,
        thumbUrl: uploaded.publicUrl,
        notes: "Project cover",
        assetType: "Image",
      });

      if (coverAsset.asset_type === "Image") {
        await createImageContentUnit({supabase, asset: coverAsset});
        const res = await fetch("/api/ingest/image", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ imageUrl: uploaded.publicUrl }),
        });

      const rawText = await res.text();

      let payload: any = null;
      try {
        payload = JSON.parse(rawText);
      } catch {
        throw new Error(
          `Image caption ingestion failed. Non-JSON response: ${rawText.slice(0, 160)}`
        );
      }

      if (!res.ok) {
        throw new Error(payload?.error ?? "Image caption ingestion failed.");
      }

        const searchText = [
          payload.caption,
          payload.imageType,
          ...(payload.keywords ?? []),
        ]
          .filter(Boolean)
          .join(". ");

        const contentUpdate = await supabase
          .from("asset_content_units")
          .update({
            generated_text: searchText,
          })
          .eq("asset_id", coverAsset.id)
          .eq("unit_index", 1);

        if (contentUpdate.error) {
          throw contentUpdate.error;
        }

        const assetUpdate = await supabase
          .from("assets")
          .update({
            ai_summary: searchText,
          })
          .eq("id", coverAsset.id);

        if (assetUpdate.error) {
          throw assetUpdate.error;
        }
      }

      const { error: updateProjectError } = await supabase
        .from("projects")
        .update({
          cover_asset_id: coverAsset.id,
        })
        .eq("id", insertedProject.id);

      if (updateProjectError) {
        throw updateProjectError;
      }

      const newProject: ProjectListItem = {
        id: insertedProject.id,
        title: insertedProject.title,
        description: insertedProject.description,
        location: insertedProject.location,
        created_at: insertedProject.created_at,
        cover_asset_id: coverAsset.id,
        cover_thumb_url: coverAsset.thumb_url,
        project_type: insertedProject.project_type,
      };

      if (onCreated) {
        onCreated(newProject);
      } else {
        router.push(`/projects/${insertedProject.id}`);
      }
    } catch (err: any) {
      console.error(err);

      if (uploadedStoragePath) {
        try {
          await removeFilesFromStorage({
            supabase,
            bucket: ASSET_BUCKET,
            paths: [uploadedStoragePath],
          });
        } catch (storageRollbackError) {
          console.error("Storage rollback failed:", storageRollbackError);
        }
      }

      if (insertedProject?.id) {
        await rollbackProject(insertedProject.id);
      }

      alert(err?.message ?? "Create project failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-2xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Title */}
        <div className="space-y-1.5">
          <Label htmlFor="project-title" className="text-sm text-neutral-700">
            Project Title
          </Label>
          <Input
            id="project-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="h-10 rounded-[12px] border-neutral-300"
            placeholder="Enter project title"
          />
        </div>

        {/* Type and location */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-sm text-neutral-700">Project Type</Label>
            <Select value={projectType} onValueChange={setProjectType}>
              <SelectTrigger className="h-10 rounded-[12px] border-neutral-300">
                <SelectValue placeholder="Select project type" />
              </SelectTrigger>
              <SelectContent>
                {PROJECT_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="project-location" className="text-sm text-neutral-700">
              Location
            </Label>
            <Input
              id="project-location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Los Angeles, CA"
              className="h-10 rounded-[12px] border-neutral-300"
            />
          </div>
        </div>

        {/* Status */}
        <div className="space-y-1.5">
          <Label className="text-sm text-neutral-700">Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-10 rounded-[12px] border-neutral-300">
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

        {/* Description */}
        <div className="space-y-1.5">
          <Label htmlFor="project-description" className="text-sm text-neutral-700">
            Description
          </Label>
          <Textarea
            id="project-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            placeholder="Write a short description of the project"
            className="min-h-[112px] rounded-[14px] border-neutral-300 resize-none"
          />
        </div>

        {/* Cover image */}
        <div className="space-y-1.5">
          <Label htmlFor="cover-upload" className="text-sm text-neutral-700">
            Cover Image
          </Label>

          <div className="rounded-[14px] border border-dashed border-neutral-300 bg-neutral-50 px-4 py-3">
            <Input
              id="cover-upload"
              type="file"
              accept="image/*"
              onChange={(e) => setImageFile(e.target.files?.[0] || null)}
              className="h-10 rounded-[12px] border-neutral-300 bg-white"
            />

            <div className="mt-2 text-xs text-neutral-500">
              Bucket path pattern: {ASSET_BUCKET}/projects/&lt;projectId&gt;/cover/&lt;filename&gt;
            </div>

            {imageFile && (
              <div className="mt-2 text-sm text-neutral-700">
                Selected file: <span className="font-medium">{imageFile.name}</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-end gap-3 border-t border-neutral-200 pt-4">
          {onCancel && (
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={submitting}
              className="h-10 rounded-[12px] border-neutral-300 px-5"
            >
              Cancel
            </Button>
          )}

          <Button
            type="submit"
            disabled={submitting}
            className="h-10 rounded-[12px] border border-[#69c98e] bg-[#8fdbab] px-5 text-black hover:brightness-95"
          >
            {submitting ? "Submitting..." : "Create Project"}
          </Button>
        </div>
      </form>
    </div>
  );
}