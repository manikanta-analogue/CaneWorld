import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { ArrowRight, Eye, EyeOff, GlassWater, KeyRound, ShieldCheck } from "lucide-react";
import {
  beginCustomerAuth,
  DUMMY_OTP,
  signInWithPin,
  verifyOtpSetPin,
  type Customer,
} from "@/lib/loyalty";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const mobileSchema = z.string().trim().regex(/^[0-9]{10}$/, "Enter a valid 10-digit mobile number");
const nameSchema = z.string().trim().min(2, "Enter your name").max(60);
const pinSchema = z.string().regex(/^[0-9]{4}$/, "PIN must be 4 digits");

type Step = "mobile" | "pin" | "otp" | "setPin";

export function CustomerAuth({
  token,
  branchName,
  branchImage,
  onReady,
}: {
  token: string;
  branchName: string;
  branchImage?: string | null | undefined;
  onReady: (customer: Customer) => void;
}) {
  const [step, setStep] = useState<Step>("mobile");
  const [mobile, setMobile] = useState("");
  const [otp, setOtp] = useState("");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [showLoginPin, setShowLoginPin] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [showConfirmPin, setShowConfirmPin] = useState(false);
  const [name, setName] = useState("");
  const [isNew, setIsNew] = useState(true);
  const [busy, setBusy] = useState(false);

  const digits = (value: string, max: number) => value.replace(/\D/g, "").slice(0, max);

  const submitMobile = async (event: React.FormEvent) => {
    event.preventDefault();
    const parsed = mobileSchema.safeParse(mobile);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid mobile number");
      return;
    }
    setBusy(true);
    try {
      const status = await beginCustomerAuth(token, parsed.data);
      setIsNew(!status.exists);
      if (status.name) setName(status.name);
      if (status.hasPin) {
        setStep("pin");
      } else {
        setStep("otp");
        toast.success(`OTP sent to ${parsed.data}. Demo code: ${DUMMY_OTP}`);
      }
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const submitPin = async (event: React.FormEvent) => {
    event.preventDefault();
    const parsed = pinSchema.safeParse(pin);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid PIN");
      return;
    }
    setBusy(true);
    try {
      onReady(await signInWithPin(token, mobile, parsed.data));
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const submitOtp = (event: React.FormEvent) => {
    event.preventDefault();
    if (otp.length !== 6) {
      toast.error("Enter the 6-digit OTP");
      return;
    }
    setPin("");
    setConfirmPin("");
    setStep("setPin");
  };

  const submitSetPin = async (event: React.FormEvent) => {
    event.preventDefault();
    const parsedPin = pinSchema.safeParse(pin);
    if (!parsedPin.success) {
      toast.error(parsedPin.error.issues[0]?.message ?? "Invalid PIN");
      return;
    }
    if (pin !== confirmPin) {
      toast.error("Both PINs must match");
      return;
    }
    let safeName = "";
    if (isNew) {
      const parsedName = nameSchema.safeParse(name);
      if (!parsedName.success) {
        toast.error(parsedName.error.issues[0]?.message ?? "Enter your name");
        return;
      }
      safeName = parsedName.data;
    }
    setBusy(true);
    try {
      const customer = await verifyOtpSetPin({
        token,
        mobile,
        otp,
        pin: parsedPin.data,
        ...(safeName ? { name: safeName } : {}),
      });
      toast.success("PIN saved. Use it next time to sign in.");
      onReady(customer);
    } catch (error) {
      toast.error((error as Error).message);
      setStep("otp");
    } finally {
      setBusy(false);
    }
  };

  const startReset = () => {
    setOtp("");
    setPin("");
    setConfirmPin("");
    setIsNew(false);
    setStep("otp");
    toast.success(`OTP sent to ${mobile}. Demo code: ${DUMMY_OTP}`);
  };

  const subtitle =
    step === "pin"
      ? "Enter your 4-digit PIN to continue"
      : step === "otp"
        ? "Verify your mobile with the OTP"
        : step === "setPin"
          ? "Create your 4-digit PIN"
          : "Sign in with your mobile to collect rewards";

  return (
    <div className="mx-auto w-full max-w-md px-4 py-10 sm:px-6">
      <div className="relative overflow-hidden rounded-4xl bg-primary p-6 text-primary-foreground shadow-lift">
        {branchImage ? (
          <>
            <img
              src={branchImage}
              alt={branchName}
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-cane-700/90 via-cane-700/40 to-transparent" />
          </>
        ) : null}
        <div className="relative">
          {branchImage ? null : (
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary-foreground/15">
              <GlassWater className="h-6 w-6" aria-hidden />
            </div>
          )}
          <h1 className="mt-4 text-2xl font-extrabold leading-tight">{branchName}</h1>
          <p className="mt-1 text-sm opacity-90">{subtitle}</p>
        </div>
      </div>

      <div className="mt-4 rounded-4xl border border-border bg-card p-5 shadow-card">
        {step === "mobile" && (
          <form className="space-y-4" onSubmit={submitMobile}>
            <div className="space-y-2">
              <Label htmlFor="mobile">Mobile number</Label>
              <Input
                id="mobile"
                inputMode="numeric"
                autoFocus
                className="h-14 rounded-2xl text-lg tracking-widest"
                placeholder="9000000001"
                value={mobile}
                onChange={(e) => setMobile(digits(e.target.value, 10))}
              />
            </div>
            <Button type="submit" className="h-14 w-full rounded-full text-base" disabled={busy}>
              {busy ? "Checking…" : "Continue"} <ArrowRight className="ml-1 h-5 w-5" />
            </Button>
          </form>
        )}

        {step === "pin" && (
          <form className="space-y-4" onSubmit={submitPin}>
            <div className="space-y-2">
              <Label htmlFor="pin" className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-primary" aria-hidden /> Your 4-digit PIN
              </Label>
              <div className="relative">
                <Input
                  id="pin"
                  type={showLoginPin ? "text" : "password"}
                  inputMode="numeric"
                  autoFocus
                  className="h-14 rounded-2xl pr-10 text-center text-2xl tracking-[0.6em]"
                  placeholder="••••"
                  value={pin}
                  onChange={(e) => setPin(digits(e.target.value, 4))}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label={showLoginPin ? "Hide PIN" : "Show PIN"}
                  onClick={() => setShowLoginPin((value) => !value)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showLoginPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">Signing in as {mobile}</p>
            </div>
            <Button type="submit" className="h-14 w-full rounded-full text-base" disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="h-12 w-full rounded-full"
              onClick={startReset}
            >
              Forgot PIN? Reset with OTP
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="h-11 w-full rounded-full text-muted-foreground"
              onClick={() => setStep("mobile")}
            >
              Change number
            </Button>
          </form>
        )}

        {step === "otp" && (
          <form className="space-y-4" onSubmit={submitOtp}>
            <div className="space-y-2">
              <Label htmlFor="otp" className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" aria-hidden /> OTP sent to {mobile}
              </Label>
              <Input
                id="otp"
                inputMode="numeric"
                autoFocus
                className="h-14 rounded-2xl text-center text-2xl tracking-[0.5em]"
                placeholder="••••••"
                value={otp}
                onChange={(e) => setOtp(digits(e.target.value, 6))}
              />
              <p className="text-xs text-muted-foreground">Demo OTP: {DUMMY_OTP}</p>
            </div>
            <Button type="submit" className="h-14 w-full rounded-full text-base">
              Verify & continue
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="h-12 w-full rounded-full"
              onClick={() => setStep("mobile")}
            >
              Change number
            </Button>
          </form>
        )}

        {step === "setPin" && (
          <form className="space-y-4" onSubmit={submitSetPin}>
            {isNew && (
              <div className="space-y-2">
                <Label htmlFor="name">Your name</Label>
                <Input
                  id="name"
                  autoFocus
                  maxLength={60}
                  className="h-14 rounded-2xl text-lg"
                  placeholder="e.g. Arjun Mehta"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="newPin">Create 4-digit PIN</Label>
              <div className="relative">
                <Input
                  id="newPin"
                  type={showPin ? "text" : "password"}
                  inputMode="numeric"
                  className="h-14 rounded-2xl pr-10 text-center text-2xl tracking-[0.6em]"
                  placeholder="••••"
                  value={pin}
                  onChange={(e) => setPin(digits(e.target.value, 4))}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label={showPin ? "Hide PIN" : "Show PIN"}
                  onClick={() => setShowPin((value) => !value)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPin">Confirm PIN</Label>
              <div className="relative">
                <Input
                  id="confirmPin"
                  type={showConfirmPin ? "text" : "password"}
                  inputMode="numeric"
                  className="h-14 rounded-2xl pr-10 text-center text-2xl tracking-[0.6em]"
                  placeholder="••••"
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(digits(e.target.value, 4))}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label={showConfirmPin ? "Hide PIN" : "Show PIN"}
                  onClick={() => setShowConfirmPin((value) => !value)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showConfirmPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                You will use this PIN to sign in next time.
              </p>
            </div>
            <Button type="submit" className="h-14 w-full rounded-full text-base" disabled={busy}>
              {busy ? "Saving…" : isNew ? "Save & start ordering" : "Save new PIN"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
