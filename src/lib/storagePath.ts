export function buildProjectCoverPath(params: {
  projectId: string;
  file: File;
}) {
  const { projectId, file } = params;

  // 1) 安全化文件名：去掉奇怪字符，避免 URL/路径问题
  const safeName = file.name
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "");

  // 2) 标准化目录结构
  return `projects/${projectId}/cover/${safeName}`;
}
