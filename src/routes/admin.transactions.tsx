import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
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
    loyalty_target_at_purchase: number | null;
    reward_quantity_at_purchase: number | null;
  }[];
};

function historicalRuleLabel(item: Row["transaction_items"][number]) {
  if (!item.loyalty_target_at_purchase || !item.reward_quantity_at_purchase) {
    return "Historical rule unavailable";
  }
  return `Buy ${item.loyalty_target_at_purchase} · Get ${item.reward_quantity_at_purchase} free`;
}

async function loadTransactions(fromIso: string, toIso: string) {
  const { data, error } = await supabase
    .from("transactions")
    .select(
      "id, created_at, total_amount, payment_method, reference_no, status, branch_id, branches(name), customers(name, mobile), transaction_items(product_name, paid_quantity, free_quantity, loyalty_target_at_purchase, reward_quantity_at_purchase)",
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
  const [page, setPage] = useState(1);
  const itemsPerPage = 15;

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
      row.reference_no.toLowerCase().includes(term) ||
      row.transaction_items.some((item) => item.product_name.toLowerCase().includes(term));
    const matchesBranch = branch === "all" || row.branch_id === branch;
    return matchesTerm && matchesBranch;
  });

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginatedTransactions = useMemo(() => {
    const startIdx = (page - 1) * itemsPerPage;
    return filtered.slice(startIdx, startIdx + itemsPerPage);
  }, [filtered, page]);

  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleBranchChange = (value: string) => {
    setBranch(value);
    setPage(1);
  };

  const download = (format: "csv" | "xlsx") =>
    exportRows(
      `transactions-${range.from}-to-${range.to}`,
      filtered.map((row) => ({
        TransactionId: row.reference_no || row.id,
        Name: row.customers?.name ?? "Walk-in",
        Branch: row.branches?.name ?? "Unknown",
        Product: row.transaction_items
          .map(
            (item) =>
              `${item.product_name}: paid ${item.paid_quantity}, free ${item.free_quantity} (${historicalRuleLabel(item)})`,
          )
          .join(", "),
        Amount: Number(row.total_amount),
        Status: row.status,
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
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search customer, mobile, product or reference"
                value={search}
                maxLength={60}
                onChange={(e) => handleSearch(e.target.value)}
              />
            </div>
            {access.isSuperAdmin && (
              <Select value={branch} onValueChange={handleBranchChange}>
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
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Transaction ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Items & reward rule used</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedTransactions.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="whitespace-nowrap text-xs font-medium">
                      {row.reference_no || row.id}
                    </TableCell>
                    <TableCell className="text-xs">
                      <span className="font-medium">{row.customers?.name ?? "Walk-in"}</span>
                      <br />
                      <span className="text-muted-foreground">{row.customers?.mobile ?? "—"}</span>
                    </TableCell>
                    <TableCell className="text-xs">{row.branches?.name ?? "Unknown"}</TableCell>
                    <TableCell className="min-w-[260px] text-xs">
                      <div className="space-y-2">
                        {row.transaction_items
                          .filter((item) => item.paid_quantity + item.free_quantity > 0)
                          .map((item, index) => (
                            <div key={`${row.id}-${item.product_name}-${index}`}>
                              <p className="font-semibold text-foreground">{item.product_name}</p>
                              <p className="text-muted-foreground">
                                Paid {item.paid_quantity} · Free {item.free_quantity}
                              </p>
                              <p className="mt-0.5 text-[11px] font-medium text-primary">
                                Rule at sale: {historicalRuleLabel(item)}
                              </p>
                            </div>
                          ))}
                        {row.transaction_items.every((item) => item.paid_quantity + item.free_quantity <= 0) && "—"}
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right text-xs font-bold">
                      {formatMoney(Number(row.total_amount))}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-[10px]">
                        {row.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                      No transactions match your filters.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination Controls */}
          {filtered.length > 0 && (
            <div className="flex items-center justify-between gap-4 border-t border-border pt-4">
              <p className="text-xs text-muted-foreground">
                Showing {(page - 1) * itemsPerPage + 1}–{Math.min(page * itemsPerPage, filtered.length)} of {filtered.length} transactions
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="inline-flex h-8 w-8 items-center justify-center rounded border border-border disabled:opacity-50"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((p) => Math.abs(p - page) <= 1 || p === 1 || p === totalPages)
                    .map((p, idx, arr) => {
                      if (idx > 0 && arr[idx - 1] !== p - 1) {
                        return <span key={`ellipsis-${p}`} className="px-1 text-muted-foreground">…</span>;
                      }
                      return (
                        <button
                          key={p}
                          onClick={() => setPage(p)}
                          className={`inline-flex h-8 w-8 items-center justify-center rounded border ${
                            page === p
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border hover:bg-muted"
                          }`}
                        >
                          {p}
                        </button>
                      );
                    })}
                </div>
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className="inline-flex h-8 w-8 items-center justify-center rounded border border-border disabled:opacity-50"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
