import { CheckCircle2, Printer } from "lucide-react";
import { formatMoney } from "@/lib/loyalty";
import { Button } from "@/components/ui/button";

export type Receipt = {
  reference: string;
  total: number;
  method: "cash" | "razorpay";
  branchName: string;
  customerName: string;
  customerMobile: string;
  lines: { name: string; paid: number; free: number; amount: number }[];
};

export function SuccessScreen({
  receipt,
  currency,
  onDone,
}: {
  receipt: Receipt;
  currency: string;
  onDone: () => void;
}) {
  const printReceipt = () => {
    const win = window.open("", "_blank", "width=420,height=640");
    if (!win) return;
    const rows = receipt.lines
      .map(
        (line) =>
          `<tr><td>${line.name} ×${line.paid}${line.free ? ` (+${line.free} free)` : ""}</td><td style="text-align:right">${formatMoney(line.amount, currency)}</td></tr>`,
      )
      .join("");
    win.document.write(
      `<html><head><title>Receipt ${receipt.reference}</title></head>
      <body style="font-family:monospace;padding:16px;max-width:320px">
        <h3 style="text-align:center;margin:0">${receipt.branchName}</h3>
        <p style="text-align:center;font-size:12px;margin:4px 0 12px">${new Date().toLocaleString("en-IN")}</p>
        <p style="font-size:12px">Customer: ${receipt.customerName} (${receipt.customerMobile})</p>
        <table style="width:100%;font-size:12px">${rows}</table>
        <hr />
        <p style="font-size:14px;font-weight:bold">TOTAL ${formatMoney(receipt.total, currency)}</p>
        <p style="font-size:12px">Method: ${receipt.method.toUpperCase()}</p>
        <p style="font-size:12px">Ref: ${receipt.reference}</p>
        <p style="text-align:center;font-size:11px">Thank you — stay fresh!</p>
      </body></html>`,
    );
    win.document.close();
    win.focus();
    win.print();
  };

  return (
    <div className="mx-auto w-full max-w-md px-4 py-12 sm:px-6">
      <div className="rounded-4xl border border-border bg-card p-6 text-center shadow-card">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-accent text-primary">
          <CheckCircle2 className="h-9 w-9" aria-hidden />
        </div>
        <h1 className="mt-4 text-2xl font-extrabold">Payment successful</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {formatMoney(receipt.total, currency)} · {receipt.method.toUpperCase()}
        </p>

        <div className="mt-5 space-y-2 rounded-2xl bg-secondary/70 p-4 text-left">
          {receipt.lines.map((line) => (
            <div key={line.name} className="flex items-center justify-between gap-3 text-sm">
              <span className="min-w-0 truncate">
                {line.name} ×{line.paid}
                {line.free ? <span className="ml-1 font-semibold text-primary">+{line.free} free</span> : null}
              </span>
              <span className="shrink-0 font-semibold">{formatMoney(line.amount, currency)}</span>
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-2xl border border-border px-4 py-3">
          <p className="text-xs text-muted-foreground">Transaction ID</p>
          <p className="font-mono text-sm font-bold">{receipt.reference}</p>
        </div>

        <div className="mt-5 space-y-2">
          <Button variant="outline" className="h-12 w-full rounded-full bg-card" onClick={printReceipt}>
            <Printer className="mr-2 h-4 w-4" /> Print receipt
          </Button>
          <Button className="h-12 w-full rounded-full" onClick={onDone}>
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}
