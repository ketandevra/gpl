import { VerificationClient } from "@/components/verification/VerificationClient";
import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export const metadata = { title: "Register as player" };
export const dynamic = "force-dynamic";

export default async function VerifyPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/verify");

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#2aa7ad]">
        Account
      </p>
      <h1 className="mt-2 text-2xl font-bold text-[#3e2723]">
        Register as player
      </h1>
      <p className="mt-2 text-sm text-[#3e2723]/65">
        Upload Aadhaar front and back so an admin can verify you before team
        selection.
      </p>
      <div className="mt-6">
        <VerificationClient />
      </div>
    </div>
  );
}
