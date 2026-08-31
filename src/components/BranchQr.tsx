import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Base used inside printed/downloaded QR codes. Prefer the deployed origin, with a local/dev override when needed. */
export function publicBase() {
  const configured = (import.meta.env.VITE_PUBLIC_APP_URL ?? "").trim().replace(/\/+$/, "");

  if (configured) {
    return configured;
  }

  if (typeof window === "undefined") {
    return "http://localhost:8080";
  }

  return window.location.origin;
}

export function branchUrl(token: string) {
  return `${publicBase()}/b/${token}`;
}

export function BranchQr({
  token,
  branchName,
  size = 220,
}: {
  token: string;
  branchName: string;
  size?: number;
}) {
  const [dataUrl, setDataUrl] = useState<string>("");

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(branchUrl(token), {
      width: size * 2,
      margin: 1,
      color: { dark: "#14532d", light: "#ffffff" },
    })
      .then((url) => {
        if (active) setDataUrl(url);
      })
      .catch(() => setDataUrl(""));
    return () => {
      active = false;
    };
  }, [token, size]);

  const download = () => {
    if (!dataUrl) return;
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = `${branchName.replace(/\s+/g, "-").toLowerCase()}-qr.png`;
    link.click();
  };

  const print = () => {
    if (!dataUrl) return;
    const win = window.open("", "_blank", "width=520,height=680");
    if (!win) return;
    win.document.write(
      `<html><head><title>${branchName} QR</title></head><body style="font-family:sans-serif;text-align:center;padding:32px">
        <h2 style="color:#14532d">${branchName}</h2>
        <p style="color:#4b5563;font-size:13px">Scan to start your order</p>
        <img src="${dataUrl}" style="width:320px;height:320px" />
        <p style="color:#6b7280;font-size:11px">${branchUrl(token)}</p>
      </body></html>`,
    );
    win.document.close();
    win.focus();
    win.print();
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="rounded-2xl border border-border bg-card p-3 shadow-card">
        {dataUrl ? (
          <img src={dataUrl} alt={`QR code for ${branchName}`} style={{ width: size, height: size }} />
        ) : (
          <div style={{ width: size, height: size }} className="animate-pulse rounded-xl bg-muted" />
        )}
      </div>
      <p className="max-w-[240px] truncate text-center text-xs text-muted-foreground">
        {branchUrl(token)}
      </p>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={download}>
          <Download className="mr-1 h-4 w-4" /> Download
        </Button>
        <Button size="sm" variant="outline" onClick={print}>
          <Printer className="mr-1 h-4 w-4" /> Print
        </Button>
      </div>
    </div>
  );
}
