import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

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
  return (
    <main className="mx-auto min-h-screen max-w-md px-5 py-8">
      <Link to="/" className="inline-flex items-center gap-1 text-sm font-semibold text-primary">
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>
      <h1 className="mt-4 text-2xl font-extrabold tracking-tight">Terms &amp; Conditions</h1>
      <p className="mt-1 text-xs text-muted-foreground">Last updated: 28 August 2026</p>

      <div className="mt-5 space-y-5 text-sm leading-relaxed text-muted-foreground">
        <section>
          <h2 className="text-base font-bold text-foreground">1. Using the app</h2>
          <p>
            This app lets you check in at one of our juice branches, order fresh juice and collect
            loyalty rewards. By scanning a branch QR code or signing in with your mobile number and
            PIN, you accept these terms.
          </p>
        </section>
        <section>
          <h2 className="text-base font-bold text-foreground">2. Your account</h2>
          <p>
            Your account is identified by your mobile number and protected by a 4-digit PIN. Keep
            your PIN private — anyone with your mobile number and PIN can redeem your rewards. Tell
            branch staff immediately if you think your account is being misused.
          </p>
        </section>
        <section>
          <h2 className="text-base font-bold text-foreground">3. Loyalty rewards</h2>
          <p>
            Each product size has its own loyalty card (for example buy 9 get the 10th glass free).
            Progress is counted per product and only for successful, paid orders. Free glasses have
            no cash value, cannot be transferred or exchanged, and are applied at the time of
            checkout. Loyalty targets, prices and product availability may change at any time.
          </p>
        </section>
        <section>
          <h2 className="text-base font-bold text-foreground">4. Orders and payments</h2>
          <p>
            Prices shown in the app are confirmed by our servers at checkout. Payments are processed
            online through our payment provider; we never store your card or bank details. An order
            is confirmed only when a reference number is shown on the success screen.
          </p>
        </section>
<section>
          <h2 className="text-base font-bold text-foreground">5. Refunds</h2>
          <p>
            All orders are final and <strong>non-refundable</strong>. We do not offer refunds,
            returns or exchanges on any product, including orders paid online or redeemed through
            loyalty rewards. Staff may, at their discretion, offer a replacement for an incorrectly
            served or faulty order, but no monetary refund is provided. See our{" "}
            <Link to="/refund" className="font-semibold text-primary">
              Refund Policy
            </Link>{" "}
            for full details.
          </p>
        </section>
        <section>
          <h2 className="text-base font-bold text-foreground">6. Acceptable use</h2>
          <p>
            Do not attempt to duplicate branch QR codes, manipulate loyalty counters, or access
            another customer&apos;s account. We may suspend accounts involved in misuse and cancel
            rewards earned unfairly.
          </p>
        </section>
        <section>
          <h2 className="text-base font-bold text-foreground">7. Changes and contact</h2>
          <p>
            We may update these terms as the service evolves; the latest version always appears on
            this page. For any question about your orders or rewards, speak to staff at your nearest
            branch.
          </p>
        </section>
      </div>

<p className="mt-6 text-xs text-muted-foreground">
        See also our{" "}
        <Link to="/privacy" className="font-semibold text-primary">
          Privacy Policy
        </Link>{" "}
        and{" "}
        <Link to="/refund" className="font-semibold text-primary">
          Refund Policy
        </Link>
        .
      </p>
    </main>
  );
}
