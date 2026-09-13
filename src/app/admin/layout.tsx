import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { getCurrentUser } from "@/lib/auth/session";
import { canAccessAdmin } from "@/lib/auth/permissions";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login?next=/admin");
  }

  if (!canAccessAdmin(user)) {
    return (
      <div className="mx-auto max-w-lg px-4 py-12 text-center">
        <h1 className="text-2xl font-bold text-[#3e2723]">Access denied</h1>
        <p className="mt-3 text-sm text-[#3e2723]/70">
          Admin tools are only available to GPL administrators.
        </p>
        <Link
          href="/profile"
          className="mt-6 inline-flex text-sm font-semibold text-[#1a7f84]"
        >
          Back to profile
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col lg:flex-row lg:items-start lg:gap-2 lg:px-4 lg:py-6">
      <AdminSidebar />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
