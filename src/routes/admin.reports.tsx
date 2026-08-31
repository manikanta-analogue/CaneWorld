import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/admin/reports")({
  component: ReportsPage,
});

type Row = {
  created_at: string;
  total_amount: number;
  free_glasses: number;
  paid_glasses: number;
  payment_method: string;
  reference_no: string;
  branch_id: string;
  branches: { name: string } | null;
  customers: { name: string; mobile: string } | null;
};

async function loadReports(fromIso: string, toIso: string, branchId: string) {
  const [{ data, error }, { data: branchRows, error: branchError }] = await Promise.all([
    supabase
      .from("transactions")
      .select(
        "created_at, total_amount, free_glasses, paid_glasses, payment_method, reference_no, branch_id, branches(name), customers(name, mobile)",
      )
      .gte("created_at", fromIso)
      .lte("created_at", toIso)
      .order("created_at", { ascending: false })
      .limit(5000),
    supabase.from("branches").select("id, name").order("name"),
  ]);
  if (error) throw error;
  if (branchError) throw branchError;
  const branches = (branchRows ?? []) as { id: string; name: string }[];
  const allRows = (data ?? []) as unknown as Row[];
  const rows =
    branchId === "all" ? allRows : allRows.filter((row) => row.branch_id === branchId);

  const bucket = (keyFn: (date: Date) => string) => {
    const map = new Map<string, number>();
    rows.forEach((row) => {
      const key = keyFn(new Date(row.created_at));
      map.set(key, (map.get(key) ?? 0) + Number(row.total_amount));
    });
    return Array.from(map, ([label, sales]) => ({ label, sales })).reverse();
  };

  const branchSales = new Map<string, number>();
  const customerSpend = new Map<string, number>();
  rows.forEach((row) => {
    const branchName = row.branches?.name ?? "Unknown";
    branchSales.set(branchName, (branchSales.get(branchName) ?? 0) + Number(row.total_amount));
    const customer = row.customers ? `${row.customers.name} · ${row.customers.mobile}` : "Walk-in";
    customerSpend.set(customer, (customerSpend.get(customer) ?? 0) + Number(row.total_amount));
  });

  // Branch-wise daily / weekly / monthly performance (always across all branches)
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const branchPerformance = branches
    .map((branch) => {
      const branchTxns = allRows.filter((row) => row.branch_id === branch.id);
      const sumAfter = (from: Date) =>
        branchTxns
          .filter((row) => new Date(row.created_at) >= from)
          .reduce((sum, row) => sum + Number(row.total_amount), 0);
      return {
        id: branch.id,
        name: branch.name,
        today: sumAfter(startOfToday),
        week: sumAfter(startOfWeek),
        month: sumAfter(startOfMonth),
        rangeTotal: branchTxns.reduce((sum, row) => sum + Number(row.total_amount), 0),
        transactions: branchTxns.length,
        paidGlasses: branchTxns.reduce((sum, row) => sum + Number(row.paid_glasses), 0),
        freeGlasses: branchTxns.reduce((sum, row) => sum + Number(row.free_glasses), 0),
      };
    })
    .sort((a, b) => b.rangeTotal - a.rangeTotal);

  return {
    rows,
    branches,
    branchPerformance,
    daily: bucket((date) => date.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })).slice(-14),
    weekly: bucket((date) => {
      const first = new Date(date);
      first.setDate(date.getDate() - date.getDay());
      return `w/c ${first.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}`;
    }).slice(-8),
    monthly: bucket((date) =>
      date.toLocaleDateString("en-IN", { month: "short", year: "2-digit" }),
    ).slice(-12),
    branchSales: Array.from(branchSales, ([name, sales]) => ({ name, sales })).sort(
      (a, b) => b.sales - a.sales,
    ),
    freeGlasses: rows.reduce((sum, row) => sum + Number(row.free_glasses), 0),
    topCustomers: Array.from(customerSpend, ([name, spend]) => ({ name, spend }))
      .sort((a, b) => b.spend - a.spend)
      .slice(0, 6),
  };
}

function SalesChart({ data }: { data: { label: string; sales: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
        <XAxis dataKey="label" fontSize={11} tickLine={false} />
        <YAxis fontSize={11} tickLine={false} width={44} />
        <Tooltip formatter={(value: number) => formatMoney(value)} />
        <Line type="monotone" dataKey="sales" stroke="var(--primary)" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function ReportsPage() {
  const { range, setRange, fromIso, toIso } = useDateRange("30d");
  const { access } = useStaffAccess();
  const [branchId, setBranchId] = useState("all");
  const { data } = useQuery({
    queryKey: ["reports", fromIso, toIso, branchId],
    queryFn: () => loadReports(fromIso, toIso, branchId),
  });

  const download = (format: "csv" | "xlsx") => {
    if (!data) return;
    exportRows(
      `sales-report-${range.from}-to-${range.to}`,
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
          <h1 className="text-2xl font-extrabold tracking-tight">Reports</h1>
          <p className="text-sm text-muted-foreground">
            {data ? `${data.freeGlasses} free glasses redeemed` : "Loading reports…"} · {range.from} →{" "}
            {range.to}
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

      {!data ? null : (
      <>


      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="rounded-2xl shadow-card">
          <CardHeader>
            <CardTitle className="text-base">Daily sales</CardTitle>
          </CardHeader>
          <CardContent className="h-56">
            <SalesChart data={data.daily} />
          </CardContent>
        </Card>
        <Card className="rounded-2xl shadow-card">
          <CardHeader>
            <CardTitle className="text-base">Weekly sales</CardTitle>
          </CardHeader>
          <CardContent className="h-56">
            <SalesChart data={data.weekly} />
          </CardContent>
        </Card>
        <Card className="rounded-2xl shadow-card">
          <CardHeader>
            <CardTitle className="text-base">Monthly sales</CardTitle>
          </CardHeader>
          <CardContent className="h-56">
            <SalesChart data={data.monthly} />
          </CardContent>
        </Card>
        <Card className="rounded-2xl shadow-card">
          <CardHeader>
            <CardTitle className="text-base">Branch-wise sales</CardTitle>
          </CardHeader>
          <CardContent className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.branchSales}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="name" fontSize={10} tickLine={false} interval={0} height={50} angle={-20} textAnchor="end" />
                <YAxis fontSize={11} tickLine={false} width={44} />
                <Tooltip formatter={(value: number) => formatMoney(value)} />
                <Bar dataKey="sales" fill="var(--primary)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl shadow-card">
        <CardHeader>
          <CardTitle className="text-base">Branch performance — daily, weekly &amp; monthly</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Branch</TableHead>
                <TableHead className="text-right">Today</TableHead>
                <TableHead className="text-right">This week</TableHead>
                <TableHead className="text-right">This month</TableHead>
                <TableHead className="text-right">Range total</TableHead>
                <TableHead className="text-right">Transactions</TableHead>
                <TableHead className="text-right">Paid glasses</TableHead>
                <TableHead className="text-right">Free glasses</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.branchPerformance.map((branch) => (
                <TableRow key={branch.id}>
                  <TableCell className="font-medium">{branch.name}</TableCell>
                  <TableCell className="text-right">{formatMoney(branch.today)}</TableCell>
                  <TableCell className="text-right">{formatMoney(branch.week)}</TableCell>
                  <TableCell className="text-right">{formatMoney(branch.month)}</TableCell>
                  <TableCell className="text-right font-bold">{formatMoney(branch.rangeTotal)}</TableCell>
                  <TableCell className="text-right">{branch.transactions}</TableCell>
                  <TableCell className="text-right">{branch.paidGlasses ?? 0}</TableCell>
                  <TableCell className="text-right">{branch.freeGlasses}</TableCell>
                </TableRow>
              ))}
              {data.branchPerformance.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                    No branch data in this range.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="rounded-2xl shadow-card">
          <CardHeader>
            <CardTitle className="text-base">Top customers</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.topCustomers.map((customer) => (
              <div
                key={customer.name}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border p-3 text-sm"
              >
                <span className="truncate">{customer.name}</span>
                <span className="font-bold">{formatMoney(customer.spend)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card className="rounded-2xl shadow-card">
          <CardHeader>
            <CardTitle className="text-base">Top branches</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.branchSales.slice(0, 6).map((branch) => (
              <div
                key={branch.name}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border p-3 text-sm"
              >
                <span className="truncate">{branch.name}</span>
                <span className="font-bold">{formatMoney(branch.sales)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
      </>
      )}
    </div>

  );
}
