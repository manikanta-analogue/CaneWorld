import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { MapPin, QrCode, ShieldCheck } from "lucide-react";
import { getPublicSettings, listPublicBranches } from "@/lib/branch.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/** Turns an admin-entered maps link / coordinates / address into a directions URL. */
function directionsUrl(branch: { map_location?: string | null; address?: string | null; name: string }) {
  const raw = (branch.map_location ?? "").trim();
  if (/^https?:\/\//i.test(raw)) return raw;
  const query = raw || branch.address || branch.name;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(query)}`;
}

const branchesQuery = queryOptions({
  queryKey: ["public-branches"],
  queryFn: () => listPublicBranches(),
  staleTime: 60_000,
});

const settingsQuery = queryOptions({
  queryKey: ["public-settings"],
  queryFn: () => getPublicSettings(),
  staleTime: 60_000,
});

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sugarcane Loyalty — Branch & Rewards Platform" },
      {
        name: "description",
        content:
          "Loyalty cards, branch POS and reports for a sugarcane juice chain. Buy 9 get the 10th glass free.",
      },
      { property: "og:title", content: "Sugarcane Loyalty — Branch & Rewards Platform" },
      {
        property: "og:description",
        content: "Digital loyalty cards per glass size, branch POS and admin reports in one PWA.",
      },
    ],
  }),
  loader: () => {
    throw redirect({ to: "/auth", search: { role: "admin" } });
  },
  errorComponent: ({ error }) => (
    <div role="alert" className="p-6 text-sm text-muted-foreground">
      {(error as Error).message}
    </div>
  ),
  notFoundComponent: () => <div className="p-6 text-sm">No branches found.</div>,
  component: Index,
});

function Index() {
  const branches = useSuspenseQuery(branchesQuery);
  const settings = useSuspenseQuery(settingsQuery);
  const banners = settings.data?.banner_urls_signed?.length
    ? settings.data.banner_urls_signed
    : settings.data?.home_banner_signed_url
      ? [settings.data.home_banner_signed_url]
      : [];

  return (
    <main className="mx-auto min-h-screen max-w-md px-5 py-10">
   
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Fresh · Loyal · Fast</p>
      <h1 className="mt-2 text-3xl font-extrabold leading-tight tracking-tight">
        Sugarcane juice loyalty, one glass at a time
      </h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Every size has its own card — 300ml buy 9 get 10th free, up to 2L buy 6 get 7th free.
      </p>


      <div className="mt-6 space-y-2">
        <Button asChild className="h-14 w-full text-base">
          <Link to="/scan">
            <QrCode className="mr-2 h-5 w-5" /> Scan branch QR
          </Link>
        </Button>
        <Button asChild variant="outline" className="h-14 w-full text-base">
          <Link to="/auth" search={{ role: "admin" }}>
            <ShieldCheck className="mr-2 h-5 w-5" /> Login as admin
          </Link>
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          Branch staff sign in with the email and password created by the admin.
        </p>
      </div>

      <h2 className="mt-8 flex items-center gap-2 text-sm font-bold">
        <QrCode className="h-4 w-4" /> Or open a branch manually
      </h2>
      <div className="mt-3 space-y-2">
        {(branches.data ?? []).map((branch) => (
          <Card key={branch.id} className="rounded-2xl shadow-card">
            <CardContent className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 p-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{branch.name}</p>
                {branch.address ? (
                  <p className="truncate text-xs text-muted-foreground">{branch.address}</p>
                ) : null}
              </div>
              <Button asChild size="icon" variant="outline" aria-label={`Directions to ${branch.name}`}>
                <a href={directionsUrl(branch)} target="_blank" rel="noopener noreferrer">
                  <MapPin className="h-4 w-4" />
                </a>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link to="/b/$token" params={{ token: branch.qr_token }}>
                  Open
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <footer className="mt-10 border-t border-border pt-4 text-center text-xs text-muted-foreground">
<div className="flex flex-wrap items-center justify-center gap-4">
          <Link to="/terms" className="font-semibold text-primary">
            Terms &amp; Conditions
          </Link>
          <Link to="/privacy" className="font-semibold text-primary">
            Privacy Policy
          </Link>
          <Link to="/refund" className="font-semibold text-primary">
            Refund Policy
          </Link>
        </div>
        <p className="mt-2">
          © {new Date().getFullYear()} {settings.data?.company_name ?? "CaneWorld"}
        </p>
      </footer>
    </main>

  );
}
