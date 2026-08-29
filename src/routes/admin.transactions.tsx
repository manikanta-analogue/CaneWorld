import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatMoney } from "@/lib/loyalty";
import { exportRows } from "@/lib/export";
import { DateRangeFilter, useDateRange } from "@/components/DateRangeFilter";
import { useStaffAccess } from "@/hooks/useStaffAccess";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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

export const Route = createFileRoute("/admin/transactions")({
  component: TransactionsPage,
});

type Row = {
  id: string;
  created_at: string;
  total_amount: number;
  payment_method: string;
  reference_no: string;
  status: string;
  branch_id: string;
  branches: { name: string } | null;
  customers: { name: string; mobile: string } | null;
  transaction_items: {
    product_name: string;
    paid_quantity: number;
    free_quantity: number;
  }[];
};

async function loadTransactions(fromIso: string, toIso: string) {
  const { data, error } = await supabase
    .from("transactions")
    .select(
      "id, created_at, total_amount, payment_method, reference_no, status, branch_id, branches(name), customers(name, mobile), transaction_items(product_name, paid_quantity, free_quantity)",
    )
    .gte("created_at", fromIso)
    .lte("created_at", toIso)
    .order("created_at", { ascending: false })
    .limit(5000);
  if (error) throw error;
  return (data ?? []) as unknown as Row[];
}

function TransactionsPage() {
  const { range, setRange, fromIso, toIso } = useDateRange("30d");
  const { data: rows = [] } = useQuery({
    queryKey: ["transactions", fromIso, toIso],
    queryFn: () => loadTransactions(fromIso, toIso),
  });
  const { access } = useStaffAccess();
  const [search, setSearch] = useState("");
  const [branch, setBranch] = useState("all");
  const [method, setMethod] = useState("all");

  const branches = useMemo(() => {
    const map = new Map<string, string>();
    rows.forEach((row) => map.set(row.branch_id, row.branches?.name ?? "Unknown"));
    return Array.from(map, ([id, name]) => ({ id, name }));
  }, [rows]);

  const filtered = rows.filter((row) => {
    const term = search.trim().toLowerCase();
    const matchesTerm =
      !term ||
      row.customers?.name.toLowerCase().includes(term) ||
      row.customers?.mobile.includes(term) ||
      row.reference_no.toLowerCase().includes(term);
    const matchesBranch = branch === "all" || row.branch_id === branch;
    const matchesMethod = method === "all" || row.payment_method === method;
    return matchesTerm && matchesBranch && matchesMethod;
  });

  const download = (format: "csv" | "xlsx") =>
    exportRows(
      `transactions-${range.from}-to-${range.to}`,
      filtered.map((row) => ({
        Date: new Date(row.created_at).toLocaleString("en-IN"),
        Branch: row.branches?.name ?? "Unknown",
        Customer: row.customers?.name ?? "Walk-in",
        Mobile: row.customers?.mobile ?? "",
        Reference: row.reference_no,
        Products: row.transaction_items
          .map(
            (item) =>
              `${item.product_name} x${item.paid_quantity}${item.free_quantity ? ` +${item.free_quantity} free` : ""}`,
          )
          .join(", "),
        Payment: row.payment_method,
        Status: row.status,
        Amount: Number(row.total_amount),
      })),
      format,
    );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Transactions</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} records</p>
        </div>
        <DateRangeFilter range={range} onChange={setRange} onExport={download} />
      </div>


      <Card className="rounded-2xl shadow-card">
        <CardContent className="space-y-4 p-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search customer, mobile or reference"
                value={search}
                maxLength={60}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            {access.isSuperAdmin && (
            <Select value={branch} onValueChange={setBranch}>
              <SelectTrigger>
                <SelectValue placeholder="Branch" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All branches</SelectItem>
                {branches.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            )}
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger>
                <SelectValue placeholder="Payment method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All methods</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="razorpay">Razorpay</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Products</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="whitespace-nowrap text-xs">
                      {new Date(row.created_at).toLocaleString("en-IN")}
                    </TableCell>
                    <TableCell className="text-xs">{row.branches?.name}</TableCell>
                    <TableCell className="text-xs">
                      <span className="font-medium">{row.customers?.name}</span>
                      <br />
                      <span className="text-muted-foreground">{row.customers?.mobile}</span>
                    </TableCell>
                    <TableCell className="text-xs">
                      {row.transaction_items
                        .filter((item) => item.paid_quantity + item.free_quantity > 0)
                        .map(
                          (item) =>
                            `${item.product_name} ×${item.paid_quantity}${
                              item.free_quantity ? ` +${item.free_quantity} free` : ""
                            }`,
                        )
                        .join(", ")}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right text-xs font-bold">
                      {formatMoney(Number(row.total_amount))}
                    </TableCell>
                    <TableCell className="text-xs uppercase">{row.payment_method}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-[10px]">
                        {row.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">
                      No transactions match your filters.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
