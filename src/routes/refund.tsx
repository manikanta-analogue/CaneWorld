import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

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
  return (
    <main className="mx-auto min-h-screen max-w-md px-5 py-8">
      <Link to="/" className="inline-flex items-center gap-1 text-sm font-semibold text-primary">
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>
      <h1 className="mt-4 text-2xl font-extrabold tracking-tight">Refund Policy</h1>
      <p className="mt-1 text-xs text-muted-foreground">Last updated: 28 August 2026</p>

      <div className="mt-5 space-y-5 text-sm leading-relaxed text-muted-foreground">
        <section>
          <h2 className="text-base font-bold text-foreground">1. No refunds</h2>
          <p>
            All orders placed through this app — whether paid online or redeemed through a loyalty
            reward — are final and <strong>non-refundable</strong>. We do not offer refunds, returns
            or exchanges on any product once the order has been placed and confirmed.
          </p>
        </section>
        <section>
          <h2 className="text-base font-bold text-foreground">2. Why no refunds</h2>
          <p>
            Juice products are freshly prepared to order and are perishable by nature. Because each
            drink is made specifically for your order, we cannot accept it back or re-sell it, and
            we therefore cannot issue a refund.
          </p>
        </section>
        <section>
          <h2 className="text-base font-bold text-foreground">3. Payment confirmation</h2>
          <p>
            Please review your order carefully before paying. Once your payment is completed and a
            confirmation reference is shown on screen, the amount is final and will not be
            refunded.
          </p>
        </section>
        <section>
          <h2 className="text-base font-bold text-foreground">4. Loyalty rewards</h2>
          <p>
            Free glasses earned through our loyalty programme have no cash value, are
            non-refundable, and cannot be exchanged for money or transferred to another person or
            account.
          </p>
        </section>
        <section>
          <h2 className="text-base font-bold text-foreground">5. Questions</h2>
          <p>
            If you have any concern about an order, please speak to staff at the branch where you
            ordered before completing your visit. Staff may, at their sole discretion, offer a
            replacement for an incorrectly served or faulty order, but no monetary refund will be
            provided.
          </p>
        </section>
      </div>

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