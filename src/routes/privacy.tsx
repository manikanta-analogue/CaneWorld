import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Sugarcane Loyalty" },
      {
        name: "description",
        content:
          "How the Sugarcane Loyalty app collects and protects your mobile number, PIN, order history and profile photo.",
      },
      { property: "og:title", content: "Privacy Policy — Sugarcane Loyalty" },
      {
        property: "og:description",
        content: "What data we collect, why we need it and how long we keep it.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <main className="mx-auto min-h-screen max-w-md px-5 py-8">
      <Link to="/" className="inline-flex items-center gap-1 text-sm font-semibold text-primary">
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>
      <h1 className="mt-4 text-2xl font-extrabold tracking-tight">Privacy Policy</h1>
      <p className="mt-1 text-xs text-muted-foreground">Last updated: 28 August 2026</p>

      <div className="mt-5 space-y-5 text-sm leading-relaxed text-muted-foreground">
        <section>
          <h2 className="text-base font-bold text-foreground">1. What we collect</h2>
          <p>
            Your name and mobile number, a securely hashed 4-digit PIN, an optional profile photo,
            and your order and loyalty history (products, quantities, amounts, branch and payment
            reference).
          </p>
        </section>
        <section>
          <h2 className="text-base font-bold text-foreground">2. Why we collect it</h2>
          <p>
            To identify you at a branch, to count loyalty progress for each product size, to show
            your bills and rewards in your account, and to help branch owners understand sales at
            their own branch.
          </p>
        </section>
        <section>
          <h2 className="text-base font-bold text-foreground">3. Payments</h2>
          <p>
            Online payments are handled by our payment provider. We receive only a payment reference
            and status — we never see or store your card, UPI or bank credentials.
          </p>
        </section>
        <section>
          <h2 className="text-base font-bold text-foreground">4. How we protect it</h2>
          <p>
            Data is stored in a managed, access-controlled database. PINs are stored only as salted
            hashes, and photos are kept in a private storage bucket served through short-lived
            links. Staff can see only the information needed to serve you.
          </p>
        </section>
        <section>
          <h2 className="text-base font-bold text-foreground">5. Sharing</h2>
          <p>
            We do not sell your data or use it for third-party advertising. We share it only with
            the service providers that run the app and process payments, or where the law requires
            it.
          </p>
        </section>
        <section>
          <h2 className="text-base font-bold text-foreground">6. Your choices</h2>
          <p>
            You can edit your name and profile photo in the Account tab at any time. To request a
            copy of your data or deletion of your account, ask staff at your nearest branch; note
            that deleting your account also removes unredeemed loyalty progress.
          </p>
        </section>
        <section>
          <h2 className="text-base font-bold text-foreground">7. Retention</h2>
          <p>
            Order records are kept for accounting and reporting purposes. Loyalty progress is kept
            while your account is active.
          </p>
        </section>
      </div>

<p className="mt-6 text-xs text-muted-foreground">
        See also our{" "}
        <Link to="/terms" className="font-semibold text-primary">
          Terms &amp; Conditions
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
