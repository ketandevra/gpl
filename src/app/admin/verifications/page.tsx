import { Suspense } from "react";
import { AdminVerificationsClient } from "@/components/admin/AdminVerificationsClient";

export const metadata = { title: "Admin · Verifications" };
export const dynamic = "force-dynamic";

export default function AdminVerificationsPage() {
  return (
    <Suspense
      fallback={
        <div className="px-4 py-8 text-sm text-[#3e2723]/60">Loading…</div>
      }
    >
      <AdminVerificationsClient />
    </Suspense>
  );
}
