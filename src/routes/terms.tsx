import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { getPublicPolicies } from "@/lib/branch.functions";
import { SafeHtmlContent } from "@/components/SafeHtmlContent";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms & Conditions — Sugarcane Loyalty" },
      {
        name: "description",
        content:
          "Terms and conditions for using the Sugarcane Loyalty app, loyalty rewards, orders and online payments.",
      },
      { property: "og:title", content: "Terms & Conditions — Sugarcane Loyalty" },
      {
        property: "og:description",
        content: "Rules for loyalty cards, free glass rewards, orders and payments.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  const { data: policies = [], isLoading } = useQuery({
    queryKey: ["public-policies"],
    queryFn: () => getPublicPolicies(),
    staleTime: 60_000,
  });

  const termsPolicy = policies.find((p) => p.policy_type === "terms");
  const lastUpdated = termsPolicy?.updated_at
    ? new Date(termsPolicy.updated_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    : "Unknown";

  return (
    <main className="mx-auto min-h-screen max-w-md px-5 py-8">
      <Link to="/" className="inline-flex items-center gap-1 text-sm font-semibold text-primary">
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>
      <h1 className="mt-4 text-2xl font-extrabold tracking-tight">{termsPolicy?.title || "Terms & Conditions"}</h1>
      <p className="mt-1 text-xs text-muted-foreground">Last updated: {lastUpdated}</p>

      {isLoading ? (
        <div className="mt-5 text-sm text-muted-foreground">Loading policy…</div>
      ) : termsPolicy?.content ? (
        <SafeHtmlContent html={termsPolicy.content} className="mt-5 space-y-5 text-sm leading-relaxed text-muted-foreground" />
      ) : (
        <div className="mt-5 text-sm text-muted-foreground">No terms available.</div>
      )}

      <p className="mt-6 text-xs text-muted-foreground">
        See also our{" "}
        <Link to="/privacy" className="font-semibold text-primary">
          Privacy Policy
        </Link>
        , and{" "}
        <Link to="/refund" className="font-semibold text-primary">
          Refund Policy
        </Link>
        .
      </p>
    </main>
  );
}
