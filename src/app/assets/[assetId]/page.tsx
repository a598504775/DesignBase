// src/app/assets/[assetId]/page.tsx
import AssetDetailPage from "@/components/AssetDetailPage";

type PageProps = {
  params: { assetId: string };
};

export default function Page({ params }: PageProps) {
  return <AssetDetailPage assetId={params.assetId} />;
}
