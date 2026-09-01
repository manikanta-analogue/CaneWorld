import { useMemo, useState } from "react";
import { Link, Outlet, createFileRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Download, Search, UserRound, ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatMoney } from "@/lib/loyalty";
import { exportRows } from "@/lib/export";
import { DateRangeFilter, useDateRange } from "@/components/DateRangeFilter";
import { useStaffAccess } from "@/hooks/useStaffAccess";
import { Button } from "@/components/ui/button";
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

export const Route = createFileRoute("/admin/customers")({
  component: CustomersPage,
});

type TransactionRow = {
  id: string;
  created_at: string;
  total_amount: number;
  payment_method: string;
  reference_no: string;
  branch_id: string;
  branches: { name: string } | null;
  customers: { id: string; name: string; mobile: string } | null;
  transaction_items: {
    product_name: string;
    paid_quantity: number;
    free_quantity: number;
    line_total: number;
    loyalty_target_at_purchase: number | null;
    reward_quantity_at_purchase: number | null;
  }[];
};

type CustomerSummary = {
  id: string;
  name: string;
  mobile: string;
  transactionCount: number;
  totalSpent: number;
  paidItems: number;
  freeItems: number;
  lastVisit: string | null;
  visitedBranches: { id: string; name: string; totalSpent: number; count: number }[];
  transactions: Array<{
    id: string;
    created_at: string;
    total_amount: number;
    payment_method: string;
    reference_no: string;
    branch_id: string;
    branch_name: string;
    items: string[];
  }>;
};

async function loadCustomerTransactions(branchId?: string | null) {
  let query = supabase
    .from("transactions")
    .select(
      "id, created_at, total_amount, payment_method, reference_no, branch_id, branches(name), customers(id, name, mobile), transaction_items(product_name, paid_quantity, free_quantity, line_total, loyalty_target_at_purchase, reward_quantity_at_purchase)",
    )
    .order("created_at", { ascending: false })
    .limit(10000);

  if (branchId) {
    query = query.eq("branch_id", branchId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as TransactionRow[];
}

function CustomersPage() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { access } = useStaffAccess();
  const { range, setRange, fromIso, toIso } = useDateRange("30d");
  const [search, setSearch] = useState("");
  const [branch, setBranch] = useState("all");
  const [page, setPage] = useState(1);
  const itemsPerPage = 10;
  const { data: rows = [] } = useQuery({
    queryKey: ["admin-customers", access.branchId, fromIso, toIso],
    queryFn: () => loadCustomerTransactions(access.isSuperAdmin ? null : access.branchId),
  });

  const branchOptions = useMemo(() => {
    const map = new Map<string, string>();
    rows.forEach((row) => {
      if (row.branch_id && row.branches?.name) map.set(row.branch_id, row.branches.name);
    });
    return Array.from(map, ([id, name]) => ({ id, name }));
  }, [rows]);

  const customerSummaries = useMemo<CustomerSummary[]>(() => {
    const map = new Map<string, CustomerSummary>();

    for (const row of rows) {
      const customer = row.customers;
      if (!customer) continue;
      const current = map.get(customer.id) ?? {
        id: customer.id,
        name: customer.name,
        mobile: customer.mobile,
        transactionCount: 0,
        totalSpent: 0,
        paidItems: 0,
        freeItems: 0,
        lastVisit: null,
        visitedBranches: [],
        transactions: [],
      };

      const txnItems = (row.transaction_items ?? [])
        .filter((item) => (item.paid_quantity ?? 0) + (item.free_quantity ?? 0) > 0)
        .map(
          (item) =>
            `${item.product_name} x${item.paid_quantity}${item.free_quantity ? ` + ${item.free_quantity} free` : ""}${item.loyalty_target_at_purchase && item.reward_quantity_at_purchase ? ` · Buy ${item.loyalty_target_at_purchase} Get ${item.reward_quantity_at_purchase} Free` : " · Historical rule unavailable"}`,
        );
      const paidItemsThisTxn = (row.transaction_items ?? []).reduce(
        (sum, item) => sum + Number(item.paid_quantity ?? 0),
        0,
      );
      const freeItemsThisTxn = (row.transaction_items ?? []).reduce(
        (sum, item) => sum + Number(item.free_quantity ?? 0),
        0,
      );

      current.transactionCount += 1;
      current.totalSpent += Number(row.total_amount ?? 0);
      current.paidItems += paidItemsThisTxn;
      current.freeItems += freeItemsThisTxn;
      current.lastVisit = !current.lastVisit || new Date(row.created_at) > new Date(current.lastVisit)
        ? row.created_at
        : current.lastVisit;

      current.transactions.push({
        id: row.id,
        created_at: row.created_at,
        total_amount: Number(row.total_amount ?? 0),
        payment_method: row.payment_method,
        reference_no: row.reference_no,
        branch_id: row.branch_id,
        branch_name: row.branches?.name ?? "Unknown",
        items: txnItems,
      });

      const branchEntry = current.visitedBranches.find((item) => item.id === row.branch_id);
      if (branchEntry) {
        branchEntry.count += 1;
        branchEntry.totalSpent += Number(row.total_amount ?? 0);
      } else {
        current.visitedBranches.push({
          id: row.branch_id,
          name: row.branches?.name ?? "Unknown",
          totalSpent: Number(row.total_amount ?? 0),
          count: 1,
        });
      }

      map.set(customer.id, current);
    }

    return Array.from(map.values()).sort((a, b) => {
      const aTime = a.lastVisit ? new Date(a.lastVisit).getTime() : 0;
      const bTime = b.lastVisit ? new Date(b.lastVisit).getTime() : 0;
      return bTime - aTime;
    });
  }, [rows]);

  const filteredCustomers = useMemo(() => {
    return customerSummaries.filter((customer) => {
      const term = search.trim().toLowerCase();
      const matchesSearch =
        !term ||
        customer.name.toLowerCase().includes(term) ||
        customer.mobile.includes(term) ||
        customer.transactions.some((txn) => txn.reference_no.toLowerCase().includes(term));
      const matchesBranch =
        !access.isSuperAdmin || branch === "all" || customer.visitedBranches.some((item) => item.id === branch);
      const matchesRange =
        customer.transactions.some((txn) => {
          const time = new Date(txn.created_at).getTime();
          return time >= new Date(fromIso).getTime() && time <= new Date(toIso).getTime();
        }) || !customer.transactions.length;

      return matchesSearch && matchesBranch && matchesRange;
    });
  }, [customerSummaries, search, branch, access.isSuperAdmin, fromIso, toIso]);

  const totalPages = Math.ceil(filteredCustomers.length / itemsPerPage);
  const paginatedCustomers = useMemo(() => {
    const startIdx = (page - 1) * itemsPerPage;
    return filteredCustomers.slice(startIdx, startIdx + itemsPerPage);
  }, [filteredCustomers, page]);

  // Reset to page 1 when filters change
  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleBranchChange = (value: string) => {
    setBranch(value);
    setPage(1);
  };

  const download = (format: "csv" | "xlsx") => {
    exportRows(
      `customers-${range.from}-to-${range.to}`,
      filteredCustomers.map((customer) => ({
        Name: customer.name,
        Mobile: customer.mobile,
        Branches: customer.visitedBranches.map((branchItem) => branchItem.name).join(" | "),
        Transactions: customer.transactionCount,
        PaidItems: customer.paidItems,
        FreeItems: customer.freeItems,
        TotalSpent: Number(customer.totalSpent),
        LastVisit: customer.lastVisit ? new Date(customer.lastVisit).toLocaleString("en-IN") : "—",
      })),
      format,
    );
  };

  if (pathname !== "/admin/customers") {
    return <Outlet />;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Customers</h1>
          <p className="text-sm text-muted-foreground">{filteredCustomers.length} customers in view</p>
        </div>
        <div className="flex items-center gap-2">
          <DateRangeFilter range={range} onChange={setRange} onExport={download} />
        </div>
      </div>

      <Card className="rounded-2xl shadow-card">
        <CardContent className="space-y-4 p-4">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1.5fr)_220px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search by name, mobile or txn reference"
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
              />
            </div>

            {access.isSuperAdmin && (
              <Select value={branch} onValueChange={handleBranchChange}>
                <SelectTrigger>
                  <SelectValue placeholder="All branches" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All branches</SelectItem>
                  {branchOptions.map((item) => (
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
                  <TableHead>Customer</TableHead>
                  {access.isSuperAdmin && <TableHead>Branch visits</TableHead>}
                  <TableHead>Transactions</TableHead>
                  <TableHead className="text-right">Paid items</TableHead>
                  <TableHead className="text-right">Free items</TableHead>
                  <TableHead className="text-right">Total spent</TableHead>
                  <TableHead>Last visit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedCustomers.map((customer) => (
                  <TableRow
                    key={customer.id}
                    className="cursor-pointer transition hover:bg-muted/40"
                    onClick={() =>
                      navigate({
                        to: "/admin/customers/$customerId",
                        params: { customerId: customer.id },
                      })
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        navigate({
                          to: "/admin/customers/$customerId",
                          params: { customerId: customer.id },
                        });
                      }
                    }}
                    tabIndex={0}
                    role="link"
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="grid h-9 w-9 place-items-center rounded-full bg-primary/10 text-primary">
                          <UserRound className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-medium text-primary hover:underline">{customer.name}</p>
                          <p className="text-xs text-muted-foreground">{customer.mobile}</p>
                        </div>
                      </div>
                    </TableCell>
                    {access.isSuperAdmin && (
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {customer.visitedBranches.map((branchItem) => (
                            <Badge key={`${customer.id}-${branchItem.id}`} variant="secondary" className="text-[10px]">
                              {branchItem.name}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                    )}
                    <TableCell>{customer.transactionCount}</TableCell>
                    <TableCell className="text-right font-medium">{customer.paidItems}</TableCell>
                    <TableCell className="text-right font-medium">{customer.freeItems}</TableCell>
                    <TableCell className="text-right font-semibold">{formatMoney(customer.totalSpent)}</TableCell>
                    <TableCell>{customer.lastVisit ? new Date(customer.lastVisit).toLocaleString("en-IN") : "—"}</TableCell>
                  </TableRow>
                ))}

                {filteredCustomers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">
                      No customers match your filters.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination Controls */}
          {filteredCustomers.length > 0 && (
            <div className="flex items-center justify-between gap-4 border-t border-border pt-4">
              <p className="text-xs text-muted-foreground">
                Showing {(page - 1) * itemsPerPage + 1}–{Math.min(page * itemsPerPage, filteredCustomers.length)} of {filteredCustomers.length} customers
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
