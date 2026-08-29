import { useMemo, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Download, Search, ShoppingBag, UserRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatMoney } from "@/lib/loyalty";
import { exportRows } from "@/lib/export";
import { DateRangeFilter, useDateRange } from "@/components/DateRangeFilter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/admin/customers/$customerId")({
  component: CustomerDetailPage,
});

type CustomerSummary = {
  id: string;
  name: string;
  mobile: string;
  created_at: string;
  image_url: string | null;
};

type CustomerTxnItem = {
  product_name: string;
  paid_quantity: number;
  free_quantity: number;
  line_total: number;
  product_id: string | null;
  category_name?: string | null;
};

type CustomerTxn = {
  id: string;
  created_at: string;
  total_amount: number;
  payment_method: string;
  reference_no: string;
  branch_id: string;
  branches: { name: string } | null;
  transaction_items: CustomerTxnItem[];
};

async function loadCustomerDetail(customerId: string) {
  const [customerRes, txnsRes] = await Promise.all([
    supabase.from("customers").select("id, name, mobile, created_at, image_url").eq("id", customerId).maybeSingle(),
    supabase
      .from("transactions")
      .select(
        "id, created_at, total_amount, payment_method, reference_no, branch_id, branches(name), transaction_items(product_id, product_name, paid_quantity, free_quantity, line_total)",
      )
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false }),
  ]);

  if (customerRes.error) throw customerRes.error;
  if (txnsRes.error) throw txnsRes.error;

  const transactionItems = (txnsRes.data ?? []) as CustomerTxn[];
  const productIds = Array.from(
    new Set(
      transactionItems.flatMap((txn) =>
        (txn.transaction_items ?? []).map((item) => item.product_id).filter(Boolean) as string[],
      ),
    ),
  );

  let categoryMap = new Map<string, string | null>();
  if (productIds.length > 0) {
    const { data: products, error: productsError } = await supabase
      .from("products")
      .select("id, category_id, categories(name)")
      .in("id", productIds);

    if (productsError) throw productsError;

    categoryMap = new Map(
      (products ?? []).map((product) => [product.id, product.categories?.name ?? null]),
    );
  }

  const normalized = transactionItems.map((txn) => ({
    ...txn,
    transaction_items: (txn.transaction_items ?? []).map((item) => ({
      ...item,
      category_name: item.product_id ? categoryMap.get(item.product_id) ?? null : null,
    })),
  }));

  return {
    customer: customerRes.data as CustomerSummary | null,
    txns: normalized,
  };
}

function CustomerDetailPage() {
  const { customerId } = Route.useParams();
  const { range, setRange, fromIso, toIso } = useDateRange("30d");
  const [search, setSearch] = useState("");
  const [branch, setBranch] = useState("all");
  const { data, isLoading } = useQuery({
    queryKey: ["customer-detail", customerId],
    queryFn: () => loadCustomerDetail(customerId),
  });

  const customer = data?.customer;
  const txns = data?.txns ?? [];
  const branchOptions = useMemo(() => {
    const map = new Map<string, string>();
    txns.forEach((txn) => {
      if (txn.branch_id && txn.branches?.name) map.set(txn.branch_id, txn.branches.name);
    });
    return Array.from(map, ([id, name]) => ({ id, name }));
  }, [txns]);

  const byCategory = useMemo(() => {
    const map = new Map<string, { category: string; total: number; qty: number; amount: number; items: string[] }>();

    for (const txn of txns) {
      for (const item of txn.transaction_items ?? []) {
        const categoryName = item.category_name ?? "Uncategorized";
        const existing = map.get(categoryName) ?? {
          category: categoryName,
          total: 0,
          qty: 0,
          amount: 0,
          items: [],
        };

        const qty = Number(item.paid_quantity ?? 0) + Number(item.free_quantity ?? 0);
        existing.total += qty;
        existing.amount += Number(item.line_total ?? 0);
        existing.qty += qty;
        existing.items.push(`${item.product_name} x${qty}`);
        map.set(categoryName, existing);
      }
    }

    return Array.from(map.values()).sort((a, b) => b.amount - a.amount);
  }, [txns]);

  const filteredTxns = useMemo(() => {
    const q = search.trim().toLowerCase();
    return txns.filter((txn) => {
      const matchesSearch =
        !q ||
        txn.reference_no.toLowerCase().includes(q) ||
        (txn.transaction_items ?? []).some((item) => item.product_name.toLowerCase().includes(q));
      const matchesBranch = branch === "all" || txn.branch_id === branch;
      const time = new Date(txn.created_at).getTime();
      const matchesRange = time >= new Date(fromIso).getTime() && time <= new Date(toIso).getTime();
      return matchesSearch && matchesBranch && matchesRange;
    });
  }, [txns, search, branch, fromIso, toIso]);

  const branchGroups = useMemo(() => {
    const map = new Map<string, { branchName: string; total: number; txns: CustomerTxn[] }>();
    for (const txn of filteredTxns) {
      const branchName = txn.branches?.name ?? "Unknown";
      const existing = map.get(branchName) ?? { branchName, total: 0, txns: [] };
      existing.total += Number(txn.total_amount ?? 0);
      existing.txns.push(txn);
      map.set(branchName, existing);
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [filteredTxns]);

  const handleDownloadCustomer = () => {
    if (!customer) return;

    const rows = filteredTxns.map((txn) => {
      const paidItems = (txn.transaction_items ?? []).reduce(
        (sum, item) => sum + Number(item.paid_quantity ?? 0),
        0,
      );
      const freeItems = (txn.transaction_items ?? []).reduce(
        (sum, item) => sum + Number(item.free_quantity ?? 0),
        0,
      );

      return {
        Date: new Date(txn.created_at).toLocaleString("en-IN"),
        Branch: txn.branches?.name ?? "Unknown",
        Reference: txn.reference_no,
        Payment: txn.payment_method,
        Total: Number(txn.total_amount ?? 0),
        PaidItems: paidItems,
        FreeItems: freeItems,
        Items: (txn.transaction_items ?? [])
          .map((item) => `${item.product_name} x${Number(item.paid_quantity ?? 0) + Number(item.free_quantity ?? 0)}`)
          .join(" | "),
      };
    });

    exportRows(`customer-${customer.name}-${customer.mobile}`.replace(/\s+/g, "-").toLowerCase(), rows, "csv");
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Button variant="outline" asChild>
          <Link to="/admin/customers">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to customers
          </Link>
        </Button>
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">Loading...</CardContent>
        </Card>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="space-y-4">
        <Button variant="outline" asChild>
          <Link to="/admin/customers">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to customers
          </Link>
        </Button>
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">Customer not found.</CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="outline" asChild>
          <Link to="/admin/customers">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to customers
          </Link>
        </Button>

        <Button variant="outline" onClick={handleDownloadCustomer}>
          <Download className="mr-2 h-4 w-4" /> Download customer
        </Button>
      </div>

      <Card className="rounded-2xl shadow-card">
        <CardContent className="space-y-3 p-4">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1.5fr)_220px_220px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search by txn ref or item"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <DateRangeFilter range={range} onChange={setRange} />
            <Select value={branch} onValueChange={setBranch}>
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
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl shadow-card">
        <CardContent className="space-y-5 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">
                <UserRound className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-2xl font-extrabold">{customer.name}</h1>
                <p className="text-sm text-muted-foreground">{customer.mobile}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Badge variant="secondary">{txns.length} transactions</Badge>
              <Badge className="bg-primary/10 text-primary">
                {formatMoney(txns.reduce((sum, txn) => sum + Number(txn.total_amount ?? 0), 0))}
              </Badge>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl bg-secondary/60 p-3">
              <p className="text-xs text-muted-foreground">Customer since</p>
              <p className="text-lg font-bold">{new Date(customer.created_at).toLocaleDateString("en-IN")}</p>
            </div>
            <div className="rounded-2xl bg-secondary/60 p-3">
              <p className="text-xs text-muted-foreground">Total spend</p>
              <p className="text-lg font-bold">
                {formatMoney(txns.reduce((sum, txn) => sum + Number(txn.total_amount ?? 0), 0))}
              </p>
            </div>
            <div className="rounded-2xl bg-secondary/60 p-3">
              <p className="text-xs text-muted-foreground">Branches visited</p>
              <p className="text-lg font-bold">{new Set(txns.map((txn) => txn.branch_id)).size}</p>
            </div>
          </div>
        </CardContent>
      </Card>

  

      <Card className="rounded-2xl shadow-card">
        <CardContent className="space-y-4 p-4">
          <h2 className="text-lg font-bold">Branch-wise transaction history</h2>

          <div className="space-y-4">
            {branchGroups.map((group) => (
              <div key={group.branchName} className="rounded-2xl border border-border p-3">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{group.branchName}</span>
                    <Badge variant="secondary">{group.txns.length} visits</Badge>
                  </div>
                  <span className="text-sm font-semibold">{formatMoney(group.total)}</span>
                </div>

                <div className="space-y-3">
                  {group.txns.map((txn) => (
                    <div key={txn.id} className="rounded-xl bg-secondary/40 p-3">
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                        <span className="font-medium">{new Date(txn.created_at).toLocaleString("en-IN")}</span>
                        <span className="text-muted-foreground">{txn.reference_no}</span>
                        <span className="font-semibold">{formatMoney(Number(txn.total_amount ?? 0))}</span>
                      </div>

                      <div className="space-y-1 text-xs text-muted-foreground">
                        {(txn.transaction_items ?? []).map((item) => (
                          <div key={`${txn.id}-${item.product_name}`}>
                            {item.product_name} ×{Number(item.paid_quantity ?? 0) + Number(item.free_quantity ?? 0)}
                            {item.category_name ? ` • ${item.category_name}` : ""}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
