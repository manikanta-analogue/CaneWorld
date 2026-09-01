import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { getPublicPolicies } from "@/lib/branch.functions";
import { SafeHtmlContent } from "@/components/SafeHtmlContent";

export const Route = createFileRoute("/refund")({
  head: () => ({
    meta: [
      { title: "Refund Policy — Sugarcane Loyalty" },
      {
        name: "description",
        content:
          "Refund policy for the Sugarcane Loyalty app. All orders and payments are final and non-refundable.",
      },
      { property: "og:title", content: "Refund Policy — Sugarcane Loyalty" },
      {
        property: "og:description",
        content: "Read our no-refund policy for orders and online payments.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RefundPage,
});

function RefundPage() {
  const { data: policies = [], isLoading } = useQuery({
    queryKey: ["public-policies"],
    queryFn: () => getPublicPolicies(),
    staleTime: 60_000,
  });

  const refundPolicy = policies.find((p) => p.policy_type === "refund");
  const lastUpdated = refundPolicy?.updated_at
    ? new Date(refundPolicy.updated_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    : "Unknown";

  return (
    <main className="mx-auto min-h-screen max-w-md px-5 py-8">
      <Link to="/" className="inline-flex items-center gap-1 text-sm font-semibold text-primary">
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>
      <h1 className="mt-4 text-2xl font-extrabold tracking-tight">{refundPolicy?.title || "Refund Policy"}</h1>
      <p className="mt-1 text-xs text-muted-foreground">Last updated: {lastUpdated}</p>

      {isLoading ? (
        <div className="mt-5 text-sm text-muted-foreground">Loading policy…</div>
      ) : refundPolicy?.content ? (
        <SafeHtmlContent html={refundPolicy.content} className="mt-5 space-y-5 text-sm leading-relaxed text-muted-foreground" />
      ) : (
        <div className="mt-5 text-sm text-muted-foreground">No refund policy available.</div>
      )}

      <p className="mt-6 text-xs text-muted-foreground">
        See also our{" "}
        <Link to="/terms" className="font-semibold text-primary">
          Terms &amp; Conditions
        </Link>{" "}
        and{" "}
        <Link to="/privacy" className="font-semibold text-primary">
          Privacy Policy
        </Link>
        .
      </p>
    </main>
  );
}