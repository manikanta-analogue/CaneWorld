import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Code2, Eye, EyeOff, Play, ShieldCheck, Sparkles, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { listPublicBranches, getPublicSettings, listPublicProducts, getBranchByToken, lookupCustomer, registerCustomer, startCustomerAuth, verifyOtpAndSetPin, loginWithPin } from "@/lib/branch.functions";
import { listBranchUsers, createBranchUser, createSuperAdminUser, resetBranchUserPassword } from "@/lib/branch-users.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/admin/api-tester")({
  component: ApiTesterPage,
});

type EndpointConfig = {
  key: string;
  category: string;
  label: string;
  description: string;
  payloadExample: string;
  run: (payload: Record<string, unknown>) => Promise<unknown>;
};

const endpointConfigs: EndpointConfig[] = [
  {
    key: "listPublicBranches",
    category: "Public",
    label: "listPublicBranches",
    description: "Load active branches for the public landing page.",
    payloadExample: "{}",
    run: async () => listPublicBranches(),
  },
  {
    key: "getPublicSettings",
    category: "Public",
    label: "getPublicSettings",
    description: "Fetch company details and banner data.",
    payloadExample: "{}",
    run: async () => getPublicSettings(),
  },
  {
    key: "listPublicProducts",
    category: "Public",
    label: "listPublicProducts",
    description: "Return the menu catalogue with signed image URLs.",
    payloadExample: "{}",
    run: async () => listPublicProducts(),
  },
  {
    key: "getBranchByToken",
    category: "Branch",
    label: "getBranchByToken",
    description: "Resolve a shop by its QR token.",
    payloadExample: JSON.stringify({ token: "brmgroad001" }, null, 2),
    run: async (payload) => getBranchByToken({ data: { token: String(payload.token ?? "") } }),
  },
  {
    key: "lookupCustomer",
    category: "Customer",
    label: "lookupCustomer",
    description: "Lookup a customer by mobile number for a branch.",
    payloadExample: JSON.stringify({ token: "brmgroad001", mobile: "9000000001" }, null, 2),
    run: async (payload) => lookupCustomer({ data: { token: String(payload.token ?? ""), mobile: String(payload.mobile ?? "") } }),
  },
  {
    key: "registerCustomer",
    category: "Customer",
    label: "registerCustomer",
    description: "Create a customer record if it does not already exist.",
    payloadExample: JSON.stringify({ token: "brmgroad001", mobile: "9000000001", name: "Arjun Mehta" }, null, 2),
    run: async (payload) => registerCustomer({ data: { token: String(payload.token ?? ""), mobile: String(payload.mobile ?? ""), name: String(payload.name ?? "") } }),
  },
  {
    key: "startCustomerAuth",
    category: "Customer",
    label: "startCustomerAuth",
    description: "Check whether a customer exists and whether they already have a PIN.",
    payloadExample: JSON.stringify({ token: "brmgroad001", mobile: "9000000001" }, null, 2),
    run: async (payload) => startCustomerAuth({ data: { token: String(payload.token ?? ""), mobile: String(payload.mobile ?? "") } }),
  },
  {
    key: "verifyOtpAndSetPin",
    category: "Customer",
    label: "verifyOtpAndSetPin",
    description: "Verify the OTP and store the customer PIN hash.",
    payloadExample: JSON.stringify({ token: "brmgroad001", mobile: "9000000001", otp: "123456", pin: "1234", name: "Arjun Mehta" }, null, 2),
    run: async (payload) => verifyOtpAndSetPin({ data: { token: String(payload.token ?? ""), mobile: String(payload.mobile ?? ""), otp: String(payload.otp ?? ""), pin: String(payload.pin ?? ""), name: payload.name ? String(payload.name) : undefined } }),
  },
  {
    key: "loginWithPin",
    category: "Customer",
    label: "loginWithPin",
    description: "Login an existing customer by mobile and PIN.",
    payloadExample: JSON.stringify({ token: "brmgroad001", mobile: "9000000001", pin: "1234" }, null, 2),
    run: async (payload) => loginWithPin({ data: { token: String(payload.token ?? ""), mobile: String(payload.mobile ?? ""), pin: String(payload.pin ?? "") } }),
  },
  {
    key: "listBranchUsers",
    category: "Admin",
    label: "listBranchUsers",
    description: "List only branch logins for the admin portal.",
    payloadExample: "{}",
    run: async () => listBranchUsers(),
  },
  {
    key: "createBranchUser",
    category: "Admin",
    label: "createBranchUser",
    description: "Create a branch login tied to a branch.",
    payloadExample: JSON.stringify({ branchId: "22222222-2222-2222-2222-222222222201", email: "mgroad@caneworld.in", password: "Test1234", fullName: "MG Road login" }, null, 2),
    run: async (payload) => createBranchUser({ data: { branchId: String(payload.branchId ?? ""), email: String(payload.email ?? ""), password: String(payload.password ?? ""), fullName: payload.fullName ? String(payload.fullName) : undefined } }),
  },
  {
    key: "resetBranchUserPassword",
    category: "Admin",
    label: "resetBranchUserPassword",
    description: "Reset the password for an existing branch login.",
    payloadExample: JSON.stringify({ userId: "a4bb76b0-b8ef-4b2a-9cf7-c5b0d7de8d7d", password: "Test1234" }, null, 2),
    run: async (payload) => resetBranchUserPassword({ data: { userId: String(payload.userId ?? ""), password: String(payload.password ?? "") } }),
  },
];

export function ApiTesterPage() {
  const [selectedKey, setSelectedKey] = useState(endpointConfigs[0].key);
  const [payloadText, setPayloadText] = useState(endpointConfigs[0].payloadExample);
  const [responseText, setResponseText] = useState("No response yet.");
  const [loading, setLoading] = useState(false);
  const [adminForm, setAdminForm] = useState({ email: "", password: "", fullName: "" });
  const [creatingAdmin, setCreatingAdmin] = useState(false);

  const selectedEndpoint = useMemo(
    () => endpointConfigs.find((item) => item.key === selectedKey) ?? endpointConfigs[0],
    [selectedKey],
  );

  const handleEndpointChange = (key: string) => {
    const next = endpointConfigs.find((item) => item.key === key) ?? endpointConfigs[0];
    setSelectedKey(next.key);
    setPayloadText(next.payloadExample);
    setResponseText("No response yet.");
  };

  const runEndpoint = async () => {
    setLoading(true);
    try {
      const payload = JSON.parse(payloadText || "{}") as Record<string, unknown>;
      const result = await selectedEndpoint.run(payload);
      setResponseText(JSON.stringify(result, null, 2));
      toast.success(`Request completed: ${selectedEndpoint.label}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setResponseText(`Error:\n${message}`);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const createAdmin = async () => {
    if (!adminForm.email || !adminForm.password) {
      toast.error("Email and password are required to create an admin.");
      return;
    }

    setCreatingAdmin(true);
    try {
      const result = await createSuperAdminUser({
        data: {
          email: adminForm.email.trim(),
          password: adminForm.password,
          fullName: adminForm.fullName.trim() || "Super Admin",
        },
      });

      toast.success(`Admin created and ready to sign in. Email: ${result.email}`);
      setAdminForm({ email: "", password: "", fullName: "" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to create the admin account.");
    } finally {
      setCreatingAdmin(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Admin setup & API tester</h1>
        <p className="text-sm text-muted-foreground">
          Create the first admin account and probe the project APIs with the exact payloads they expect.
        </p>
      </div>

      <Card className="rounded-2xl shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4" /> Create admin account
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-2 md:col-span-1">
              <Label htmlFor="admin-name">Full name</Label>
              <Input
                id="admin-name"
                value={adminForm.fullName}
                onChange={(e) => setAdminForm((current) => ({ ...current, fullName: e.target.value }))}
                placeholder="Super Admin"
              />
            </div>
            <div className="space-y-2 md:col-span-1">
              <Label htmlFor="admin-email">Email</Label>
              <Input
                id="admin-email"
                type="email"
                value={adminForm.email}
                onChange={(e) => setAdminForm((current) => ({ ...current, email: e.target.value }))}
                placeholder="admin@yourcompany.com"
              />
            </div>
            <div className="space-y-2 md:col-span-1">
              <Label htmlFor="admin-password">Password</Label>
              <div className="relative">
                <Input
                  id="admin-password"
                  type={showAdminPassword ? "text" : "password"}
                  value={adminForm.password}
                  onChange={(e) => setAdminForm((current) => ({ ...current, password: e.target.value }))}
                  placeholder="Minimum 6 chars"
                  className="pr-10"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label={showAdminPassword ? "Hide admin password" : "Show admin password"}
                  onClick={() => setShowAdminPassword((value) => !value)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showAdminPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>
          <Button onClick={createAdmin} disabled={creatingAdmin} className="w-full md:w-auto">
            <Sparkles className="mr-2 h-4 w-4" />
            {creatingAdmin ? "Creating…" : "Create admin"}
          </Button>
        </CardContent>
      </Card>

      <Card className="rounded-2xl shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Code2 className="h-4 w-4" /> API test harness
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
            <div className="space-y-2">
              <Label>Endpoint</Label>
              <div className="space-y-2">
                {endpointConfigs.map((endpoint) => (
                  <button
                    key={endpoint.key}
                    type="button"
                    onClick={() => handleEndpointChange(endpoint.key)}
                    className={`w-full rounded-xl border p-3 text-left transition-colors ${
                      selectedKey === endpoint.key
                        ? "border-primary bg-primary/5"
                        : "border-border bg-background hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold">{endpoint.label}</span>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                        {endpoint.category}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{endpoint.description}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">Payload</p>
                  <p className="text-xs text-muted-foreground">Use valid JSON only.</p>
                </div>
                <Button onClick={runEndpoint} disabled={loading}>
                  <Play className="mr-2 h-4 w-4" />
                  {loading ? "Running…" : "Run API"}
                </Button>
              </div>

              <Textarea
                value={payloadText}
                onChange={(e) => setPayloadText(e.target.value)}
                className="min-h-[220px] font-mono text-xs"
              />

              <div className="rounded-xl border border-border bg-muted/30 p-3">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                  <Wand2 className="h-4 w-4" /> Required fields
                </div>
                <pre className="whitespace-pre-wrap text-xs text-muted-foreground">
                  {selectedEndpoint.payloadExample}
                </pre>
              </div>

              <div className="rounded-xl border border-border bg-background p-3">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                  <Code2 className="h-4 w-4" /> Response
                </div>
                <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap text-xs text-foreground">
                  {responseText}
                </pre>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
