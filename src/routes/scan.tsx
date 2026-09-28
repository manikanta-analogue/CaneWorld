import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";
import { QrScanner } from "@/components/QrScanner";
//
export const Route = createFileRoute("/scan")({
  head: () => ({
    meta: [
      { title: "Scan Branch QR — Sugarcane Loyalty" },
      {
        name: "description",
        content:
          "Scan the branch QR code with your camera to open the sugarcane juice branch portal and start an order.",
      },
      { property: "og:title", content: "Scan Branch QR — Sugarcane Loyalty" },
      {
        property: "og:description",
        content: "Use your phone camera to scan a branch QR and open the loyalty POS portal.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ScanPage,
});

function ScanPage() {
  const navigate = useNavigate();

  return (
    <main className="mx-auto min-h-screen max-w-md px-5 py-8">
      <h1 className="text-2xl font-extrabold tracking-tight">Scan branch QR</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Hold the code inside the frame — the branch portal opens automatically.
      </p>
      <div className="mt-6">
        <ClientOnly fallback={<div className="h-72 animate-pulse rounded-3xl bg-muted" />}>
          <QrScanner onToken={(token) => navigate({ to: "/b/$token", params: { token } })} />
        </ClientOnly>
      </div>
    </main>
  );
}
