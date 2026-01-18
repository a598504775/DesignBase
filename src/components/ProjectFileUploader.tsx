'use client';

import { useState } from 'react';
import { createClient } from "@/utils/supabase/client";

const supabase = createClient();

type Props = { projectId: string };

export default function ProjectFileUploader({ projectId }: Props) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);

    try {
      const bucket = 'designbase-assets';

      const fileExt = file.name.includes('.') ? file.name.split('.').pop() : '';
      const safeExt = fileExt ? `.${fileExt}` : '';
      const fileName = `${Date.now()}-${Math.random().toString(16).slice(2)}${safeExt}`;
      const filePath = `${projectId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase.from('assets').insert({
        project_id: projectId,
        file_name: file.name,
        storage_path: filePath,
        notes: null,
      });

      if (dbError) throw dbError;

      alert('上传成功');
    } catch (e: unknown) {
      console.error(e);
      const msg =
        typeof e === 'object' && e && 'message' in e ? String((e as any).message) : '上传失败';
      setError(msg);
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  return (
    <div className="space-y-2">
      <input type="file" onChange={handleUpload} disabled={uploading} />
      {uploading && <p>正在上传…</p>}
      {error && <p className="text-red-500 text-sm">{error}</p>}
    </div>
  );
}
