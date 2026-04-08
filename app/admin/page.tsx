import AdminOpsDashboard from "@/components/admin/AdminOpsDashboard";
import { loadAdminOpsSnapshot, requirePlatformAdmin } from "@/lib/server/admin-ops";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  await requirePlatformAdmin();
  const snapshot = await loadAdminOpsSnapshot();

  return <AdminOpsDashboard snapshot={snapshot} />;
}
