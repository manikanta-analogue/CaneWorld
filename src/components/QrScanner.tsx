import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Camera, CameraOff } from "lucide-react";
import { Button } from "@/components/ui/button";

function extractToken(text: string): string | null {
  const trimmed = text.trim();
  const match = trimmed.match(/\/b\/([A-Za-z0-9_-]{6,})/);
  if (match?.[1]) return match[1];
  if (/^[A-Za-z0-9]{16,}$/.test(trimmed)) return trimmed;
  return null;
}

export function QrScanner({ onToken }: { onToken: (token: string) => void }) {
  const containerId = "qr-scanner-region";
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(true);

  useEffect(() => {
    if (!active) return;
    let stopped = false;
    const scanner = new Html5Qrcode(containerId, { verbose: false });
    scannerRef.current = scanner;

    scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (decoded) => {
          const token = extractToken(decoded);
          if (!token || stopped) return;
          stopped = true;
          scanner.stop().catch(() => undefined);
          onToken(token);
        },
        () => undefined,
      )
      .catch((err: unknown) => {
        setError(
          (err as Error)?.message ??
            "Camera unavailable. Allow camera access or open the QR link directly.",
        );
      });

    return () => {
      stopped = true;
      scanner.stop().catch(() => undefined);
      scanner.clear();
    };
  }, [active, onToken]);

  return (
    <div className="space-y-3">
      <div
        id={containerId}
        className="overflow-hidden rounded-3xl border border-border bg-muted shadow-card [&_video]:w-full"
      />
      {error ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          <p className="flex items-center gap-2 font-semibold">
            <CameraOff className="h-4 w-4" /> Camera blocked
          </p>
          <p className="mt-1 text-xs">{error}</p>
        </div>
      ) : (
        <p className="text-center text-xs text-muted-foreground">
          Point the camera at the branch QR code
        </p>
      )}
      <Button
        variant="outline"
        className="w-full"
        onClick={() => {
          setError(null);
          setActive(false);
          window.setTimeout(() => setActive(true), 120);
        }}
      >
        <Camera className="mr-2 h-4 w-4" /> Restart camera
      </Button>
    </div>
  );
}
