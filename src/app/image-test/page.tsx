// src/app/image-test/page.tsx
import Image from "next/image";

const url =
  "https://uehbnbexnuxqunxpjpmy.supabase.co/storage/v1/object/public/designbase-assets/_.jpeg";

export default function Page() {
  return (
    <div style={{ padding: 24 }}>
      <div style={{ position: "relative", width: 600, height: 400 }}>
        <Image src={url} alt="test" fill style={{ objectFit: "cover" }} />
      </div>

      <div style={{ marginTop: 12 }}>
        <a href={url} target="_blank" rel="noreferrer">
          Open original
        </a>
      </div>
    </div>
  );
}
