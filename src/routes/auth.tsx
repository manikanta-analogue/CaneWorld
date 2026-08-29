import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Eye, EyeOff, Leaf, Store, UserCog } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { signProductImage } from "@/lib/product-images";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Staff Sign In — CaneWorld" },
      { name: "description", content: "Sign in to the CaneWorld admin portal." },
      { property: "og:title", content: "Staff Sign In — CaneWorld" },
      { property: "og:description", content: "Sign in to the CaneWorld admin portal." },
    ],
  }),
  component: AuthPage,
});

type Mode = "login" | "signup" | "forgot";
type Role = "admin" | "branch";

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("login");
  const [role, setRole] = useState<Role>("branch");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [brandLogo, setBrandLogo] = useState<string | null>(null);
  const [brandName, setBrandName] = useState("CaneWorld");

  useEffect(() => {
    let isMounted = true;
    void (async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("company_name, logo_url")
        .eq("id", 1)
        .maybeSingle();
      if (!isMounted) return;
      if (data?.company_name) setBrandName(data.company_name);
      if (!data?.logo_url) {
        setBrandLogo(null);
        return;
      }
      if (/^https?:\/\//i.test(data.logo_url)) {
        setBrandLogo(data.logo_url);
        return;
      }
      const signed = await signProductImage(data.logo_url);
      setBrandLogo(signed ?? null);
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        navigate({ to: "/admin" });
      } else if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: window.location.origin + "/admin" },
        });
        if (error) throw error;
        toast.success("Account created. Signing you in…");
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (signInError) throw signInError;
        navigate({ to: "/admin" });
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: window.location.origin + "/reset-password",
        });
        if (error) throw error;
        toast.success("Password reset link sent to your email.");
        setMode("login");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary/40 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <div className="grid h-12 w-12 place-items-center overflow-hidden rounded-2xl bg-primary text-primary-foreground shadow-lift">
            {brandLogo ? (
              <img src={brandLogo} alt={`${brandName} logo`} className="h-full w-full object-cover bg-background" />
            ) : (
              <Leaf className="h-6 w-6" />
            )}
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">{brandName}</h1>
          <p className="text-sm text-muted-foreground">Admin & branch management portal</p>
        </div>

        <Card className="rounded-3xl border-border shadow-card">
          <CardContent className="pt-6">
            <div className="mb-5 grid grid-cols-2 gap-2 rounded-2xl bg-muted p-1.5">
              {(
                [
                  { value: "admin", label: "Admin login", icon: UserCog },
                  { value: "branch", label: "Branch login", icon: Store },
                ] as const
              ).map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    setRole(option.value);
                    setMode("login");
                  }}
                  className={`flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-colors ${
                    role === option.value
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <option.icon className="h-4 w-4" />
                  {option.label}
                </button>
              ))}
            </div>

            <form className="space-y-4" onSubmit={submit}>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={
                    role === "branch" ? "mgroad@caneworld.in" : "admin@gmail.com"
                  }
                />
              </div>
              {mode !== "forgot" && (
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      required
                      minLength={6}
                      autoComplete={mode === "login" ? "current-password" : "new-password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      onClick={() => setShowPassword((value) => !value)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              )}
              <Button type="submit" className="h-12 w-full text-base" disabled={busy}>
                {busy
                  ? "Please wait…"
                  : mode === "login"
                    ? role === "branch"
                      ? "Login to branch"
                      : "Login as admin"
                    : mode === "signup"
                      ? "Create staff account"
                      : "Send reset link"}
              </Button>
            </form>

            <div className="mt-4 flex flex-col gap-1 text-center text-sm">
              {mode === "login" && (
                <>
                  <button
                    className="text-primary hover:underline"
                    onClick={() => setMode("forgot")}
                    type="button"
                  >
                    Forgot password?
                  </button>
                  {role === "admin" && (
                    <button
                      className="text-muted-foreground hover:underline"
                      onClick={() => setMode("signup")}
                      type="button"
                    >
                      First time here? Create a staff account
                    </button>
                  )}
                  {role === "branch" && (
                    <p className="text-xs text-muted-foreground">
                      Branch login details are created by the admin under Branches.
                    </p>
                  )}
                </>
              )}
              {mode !== "login" && (
                <button
                  className="text-muted-foreground hover:underline"
                  onClick={() => setMode("login")}
                  type="button"
                >
                  Back to login
                </button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
