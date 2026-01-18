// src/app/projects/[projectId]/page.tsx
import ProjectDetailPage from "@/components/ProjectDetailPage";

type PageProps = {
  params: { projectId: string };
};

export default function Page({ params }: PageProps) {
  return <ProjectDetailPage projectId={params.projectId} />;
}
