import { createFileRoute, redirect } from "@tanstack/react-router";

/** Merged into the single Menu screen — kept as a permanent redirect for old links. */
export const Route = createFileRoute("/admin/categories")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/menu", replace: true });
  },
});
