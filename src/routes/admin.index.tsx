import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Gift, IndianRupee, Receipt, Store, TrendingUp, Users } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { formatMoney } from "@/lib/loyalty";
import { exportRows } from "@/lib/export";
import { DateRangeFilter, useDateRange } from "@/components/DateRangeFilter";
import { useStaffAccess } from "@/hooks/useStaffAccess";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/admin/")({
  component: Dashboard,
});

type TxnRow = {
  id: string;
  branch_id: string;
  total_amount: number;
  free_glasses: number;
  paid_glasses: number;
  payment_method: string;
  reference_no: string;
  created_at: string;
  branches: { name: string } | null;
  customers: { name: string; mobile: string } | null;
};

async function loadDashboard(fromIso: string, toIso: string, branchId: string) {
  const [branches, customers, txns] = await Promise.all([
    supabase.from("branches").select("id, name, status").order("name"),
    supabase.from("customers").select("id", { count: "exact", head: true }),
    supabase
      .from("transactions")
      .select(
        "id, branch_id, total_amount, free_glasses, paid_glasses, payment_method, reference_no, created_at, branches(name), customers(name, mobile)",
      )
      .gte("created_at", fromIso)
      .lte("created_at", toIso)
      .order("created_at", { ascending: false })
      .limit(1000),
  ]);

  if (branches.error) throw branches.error;
  if (txns.error) throw txns.error;

  const allRows = (txns.data ?? []) as unknown as TxnRow[];
  const rows = branchId === "all" ? allRows : allRows.filter((row) => row.branch_id === branchId);

  const perBranch = new Map<string, number>();
  for (const row of rows) {
    const name = row.branches?.name ?? "Unknown";
    perBranch.set(name, (perBranch.get(name) ?? 0) + Number(row.total_amount));
  }

  return {
    rows,
    branches: branches.data ?? [],
    totalBranches: branchId === "all" ? (branches.data ?? []).length : 1,
    totalCustomers: customers.count ?? 0,
    sales: rows.reduce((sum, row) => sum + Number(row.total_amount), 0),
    transactions: rows.length,
    freeGlasses: rows.reduce((sum, row) => sum + Number(row.free_glasses), 0),
    paidGlasses: rows.reduce((sum, row) => sum + Number(row.paid_glasses), 0),
    recent: rows.slice(0, 8),
    branchPerformance: Array.from(perBranch, ([name, sales]) => ({ name, sales })).sort(
      (a, b) => b.sales - a.sales,
    ),
  };
}

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card className="rounded-2xl shadow-card">
      <CardContent className="flex items-center gap-3 p-4">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent text-accent-foreground">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs text-muted-foreground">{label}</p>
          <p className="truncate text-lg font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function Dashboard() {
  const { range, setRange, fromIso, toIso } = useDateRange("30d");
  const { access } = useStaffAccess();
  const [branchId, setBranchId] = useState("all");
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", fromIso, toIso, branchId],
    queryFn: () => loadDashboard(fromIso, toIso, branchId),
  });

  const download = (format: "csv" | "xlsx") => {
    if (!data) return;
    exportRows(
      `dashboard-${range.from}-to-${range.to}`,
      data.rows.map((row) => ({
        Date: new Date(row.created_at).toLocaleString("en-IN"),
        Branch: row.branches?.name ?? "Unknown",
        Customer: row.customers?.name ?? "Walk-in",
        Mobile: row.customers?.mobile ?? "",
        Reference: row.reference_no,
        Payment: row.payment_method,
        "Paid glasses": row.paid_glasses,
        "Free glasses": row.free_glasses,
        Amount: Number(row.total_amount),
      })),
      format,
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">
            {access.isSuperAdmin ? "Dashboard" : `${access.branchName ?? "Branch"} Dashboard`}
          </h1>
          <p className="text-sm text-muted-foreground">
            {range.from} → {range.to}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {access.isSuperAdmin && (
          <Select value={branchId} onValueChange={setBranchId}>
            <SelectTrigger className="w-[180px] bg-card">
              <SelectValue placeholder="All branches" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All branches</SelectItem>
              {(data?.branches ?? []).map((branch) => (
                <SelectItem key={branch.id} value={branch.id}>
                  {branch.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          )}
          <DateRangeFilter range={range} onChange={setRange} onExport={download} />
        </div>
      </div>


      {isLoading || !data ? (
        <p className="text-sm text-muted-foreground">Loading dashboard…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <StatCard label="Total Branches" value={String(data.totalBranches)} icon={Store} />
            <StatCard label="Sales in range" value={formatMoney(data.sales)} icon={IndianRupee} />
            <StatCard label="Transactions" value={String(data.transactions)} icon={Receipt} />
            <StatCard label="Free glasses" value={String(data.freeGlasses)} icon={Gift} />
            <StatCard label="Total Customers" value={String(data.totalCustomers)} icon={Users} />
            <StatCard label="Paid glasses" value={String(data.paidGlasses)} icon={TrendingUp} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="rounded-2xl shadow-card">
              <CardHeader>
                <CardTitle className="text-base">Branch performance</CardTitle>
              </CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.branchPerformance}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                    <XAxis dataKey="name" tickLine={false} fontSize={11} interval={0} height={50} angle={-20} textAnchor="end" />
                    <YAxis tickLine={false} fontSize={11} width={44} />
                    <Tooltip formatter={(value: number) => formatMoney(value)} />
                    <Bar dataKey="sales" fill="var(--primary)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="rounded-2xl shadow-card">
              <CardHeader>
                <CardTitle className="text-base">Recent transactions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {data.recent.map((row) => (
                  <div
                    key={row.id}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border p-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{row.customers?.name ?? "Walk-in"}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {row.branches?.name} · {new Date(row.created_at).toLocaleString("en-IN")}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold">{formatMoney(Number(row.total_amount))}</p>
                      <Badge variant="secondary" className="mt-1 text-[10px] uppercase">
                        {row.payment_method}
                      </Badge>
                    </div>
                  </div>
                ))}
                {data.recent.length === 0 && (
                  <p className="text-sm text-muted-foreground">No transactions in this range.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
