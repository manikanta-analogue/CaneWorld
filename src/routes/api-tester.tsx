import { createFileRoute } from "@tanstack/react-router";
import { ApiTesterPage } from "@/routes/admin.api-tester";

export const Route = createFileRoute("/api-tester")({
  component: PublicApiTesterRoute,
});

function PublicApiTesterRoute() {
  return <ApiTesterPage />;
}
