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

  async function rollbackProject(projectId: string) {
    try {
      await supabase.from("projects").delete().eq("id", projectId);
    } catch {
      // ignore rollback failure for now
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
      // 1) Create the project first
      const { data: createdProject, error: createProjectError } = await supabase
        .from("projects")
        .insert([
          {
            title: title.trim(),
            description: description.trim() || null,
            status: status || null,
            project_type: projectType || null,
          },
        ])
        .select("id, title, description, location, created_at, cover_asset_id, project_type")
        .single();

      if (createProjectError) {
        throw createProjectError;
      }

      insertedProject = createdProject as InsertedProject;

      // 2) Upload cover file to storage
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

      // 3) Insert a matching asset row
      const coverAsset = await createAssetRow({
        supabase,
        projectId: insertedProject.id,
        file: imageFile,
        storagePath: uploaded.storagePath,
        thumbUrl: uploaded.publicUrl,
        notes: "Project cover",
        assetType: "Image",
      });

      // 4) Point the project to this cover asset
      const { error: updateProjectError } = await supabase
        .from("projects")
        .update({
          cover_asset_id: coverAsset.id,
        })
        .eq("id", insertedProject.id);

      if (updateProjectError) {
        throw updateProjectError;
      }

      // 5) Return a list-friendly object
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

      // rollback storage file if it was uploaded
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

      // rollback created project if it exists
      if (insertedProject?.id) {
        await rollbackProject(insertedProject.id);
      }

      alert(err?.message ?? "Create project failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl space-y-6 p-6">
      <h1 className="text-2xl font-bold">Create New Project</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="project-title">Project Title</Label>
          <Input
            id="project-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>

        <div>
          <Label>Project Type</Label>
          <Select value={projectType} onValueChange={setProjectType}>
            <SelectTrigger>
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

        <div>
          <Label htmlFor="project-description">Description</Label>
          <Textarea
            id="project-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
          />
        </div>

        <div>
          <Label>Status</Label>
          <Select value={status} onValueChange={setStatus}>
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
          <Label htmlFor="cover-upload">Upload Cover Image</Label>
          <Input
            id="cover-upload"
            type="file"
            accept="image/*"
            onChange={(e) => setImageFile(e.target.files?.[0] || null)}
          />
          <div className="mt-1 text-xs text-muted-foreground">
            Bucket path pattern: {ASSET_BUCKET}/projects/&lt;projectId&gt;/cover/&lt;filename&gt;
          </div>
        </div>

        <div className="flex gap-3">
          {onCancel && (
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={onCancel}
              disabled={submitting}
            >
              Cancel
            </Button>
          )}

          <Button
            type="submit"
            className="flex-1"
            disabled={submitting}
          >
            {submitting ? "Submitting..." : "Submit"}
          </Button>
        </div>
      </form>
    </div>
  );
}