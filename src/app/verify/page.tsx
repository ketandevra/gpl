import { VerificationClient } from "@/components/verification/VerificationClient";
import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export const metadata = { title: "Register as player" };
export const dynamic = "force-dynamic";

export default async function VerifyPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/verify");

  return (
    <div className="page max-w-lg">
      <h1 className="page-title mt-1 hidden md:block">
        Register as player
      </h1>
      <div className="mt-1 md:mt-6">
        <VerificationClient />
      </div>
    </div>
  );
}
