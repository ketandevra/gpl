import { LogoutButton } from "@/components/auth/LogoutButton";
import { VerificationClient } from "@/components/verification/VerificationClient";
import { needsVerificationLock } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export const metadata = { title: "Register as player" };
export const dynamic = "force-dynamic";

export default async function VerifyPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/verify");
  const locked = needsVerificationLock(user);

  return (
    <div className="page max-w-lg">
      <div className="flex items-center justify-between gap-3">
        {locked ? (
          <p className="text-sm font-semibold text-[#3e2723]">
            Complete verification
          </p>
        ) : (
          <h1 className="page-title mt-1 hidden md:block">Register as player</h1>
        )}
        <LogoutButton />
      </div>
      <div className="mt-4">
        <VerificationClient />
      </div>
    </div>
  );
}
