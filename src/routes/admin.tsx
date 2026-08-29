import { Link, Outlet, createFileRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  BarChart3,
  Code2,
  KeyRound,
  ListTree,
  LayoutDashboard,
  LogOut,
  Receipt,
  Settings,
  Store,
  Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useStaffSession } from "@/hooks/useStaffSession";
import { useStaffAccess } from "@/hooks/useStaffAccess";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { signProductImage } from "@/lib/product-images";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin Portal — CaneWorld" },
      { name: "description", content: "Manage branches, products, loyalty and sales reports." },
      { property: "og:title", content: "Admin Portal — CaneWorld" },
      { property: "og:description", content: "Manage branches, products, loyalty and sales reports." },
    ],
  }),
  component: AdminLayout,
});

const items = [
  { title: "Dashboard", url: "/admin", icon: LayoutDashboard },
  { title: "Branches", url: "/admin/branches", icon: Store },
  { title: "Menu", url: "/admin/menu", icon: ListTree },
  { title: "Customers", url: "/admin/customers", icon: Users },
  { title: "Transactions", url: "/admin/transactions", icon: Receipt },
  { title: "Reports", url: "/admin/reports", icon: BarChart3 },
  { title: "API Tester", url: "/admin/api-tester", icon: Code2 },
  { title: "Settings", url: "/admin/settings", icon: Settings },
  { title: "Change password", url: "/admin/change-password", icon: KeyRound },
];


const branchAllowed = new Set(["/admin", "/admin/menu", "/admin/customers", "/admin/transactions", "/admin/reports", "/admin/change-password"]);

function AdminLayout() {
  const { session, loading } = useStaffSession();
  const { access, loading: accessLoading } = useStaffAccess();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const customerRoutesAllowed = pathname === "/admin/customers" || pathname.startsWith("/admin/customers/");
  const { data: brandData } = useQuery({
    queryKey: ["admin-brand"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("company_name, logo_url")
        .eq("id", 1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const [brandLogo, setBrandLogo] = useState<string | null>(null);

  useEffect(() => {
    if (!brandData?.logo_url) {
      setBrandLogo(null);
      return;
    }

    if (/^https?:\/\//i.test(brandData.logo_url)) {
      setBrandLogo(brandData.logo_url);
      return;
    }

    let isMounted = true;
    void signProductImage(brandData.logo_url).then((url) => {
      if (isMounted) {
        setBrandLogo(url ?? null);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [brandData?.logo_url]);

  const brandName = brandData?.company_name || "CaneWorld";
  const brandInitials = brandName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "SF";

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Loading portal…
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-xl font-bold">Staff sign in required</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          The admin portal is available to signed-in staff only.
        </p>
        <Button onClick={() => navigate({ to: "/auth" })}>Go to sign in</Button>
      </div>
    );
  }

  if (accessLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Loading portal…
      </div>
    );
  }

  const visibleItems = access.isSuperAdmin
    ? items
    : items.filter((item) => branchAllowed.has(item.url));

  if (!access.isSuperAdmin && !branchAllowed.has(pathname) && !customerRoutesAllowed) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Button onClick={() => navigate({ to: "/admin" })}>Back to dashboard</Button>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="admin-scope flex min-h-screen w-full">
        <Sidebar collapsible="icon">
          <SidebarContent>
            <div className="flex items-center gap-2 px-4 py-5">
              {brandLogo ? (
                <img src={brandLogo} alt={`${brandName} logo`} className="h-9 w-9 shrink-0 rounded-xl border border-border bg-background object-cover" />
              ) : (
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
                  <span className="text-xs font-extrabold">{brandInitials}</span>
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-bold">{brandName}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {access.isSuperAdmin ? "Super Admin" : (access.branchName ?? "Branch login")}
                </p>
              </div>
            </div>
            <SidebarGroup>
              <SidebarGroupLabel>Manage</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {visibleItems.map((item) => (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton asChild isActive={pathname === item.url}>
                        <Link to={item.url} className="flex items-center gap-2">
                          <item.icon className="h-4 w-4" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-10 flex h-14 items-center justify-between gap-3 border-b border-border bg-background/90 px-3 backdrop-blur">
            <div className="flex min-w-0 items-center gap-2">
              <SidebarTrigger />
              <span className="truncate text-sm font-semibold">
                {access.isSuperAdmin ? "Admin Portal" : `${access.branchName ?? "Branch"} Portal`}
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                await queryClient.cancelQueries();
                queryClient.clear();
                await supabase.auth.signOut();
                navigate({ to: "/auth", replace: true });
              }}
            >
              <LogOut className="mr-1 h-4 w-4" /> Sign out
            </Button>
          </header>
          <main className="min-w-0 flex-1 p-3 sm:p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
