import ProjectDetailPage from "@/components/ProjectDetailPage";

type PageProps = {
  params: Promise<{ projectId: string }>;
};

export default async function Page({ params }: PageProps) {
  const { projectId } = await params;
  return <ProjectDetailPage projectId={projectId} />;
}