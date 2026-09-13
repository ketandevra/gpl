import Link from "next/link";
import { redirect } from "next/navigation";
import { BackLink } from "@/components/ui/BackLink";
import { getCurrentUser } from "@/lib/auth/session";
import { canAccessAdmin } from "@/lib/auth/permissions";

export const metadata = { title: "Register team" };
export const dynamic = "force-dynamic";

/** Public self-serve team create is disabled. */
export default async function RegisterTeamPage() {
  const user = await getCurrentUser();
  if (canAccessAdmin(user)) {
    redirect("/admin/teams");
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <BackLink href="/teams">Back to teams</BackLink>
      <h1 className="mt-5 text-2xl font-bold text-[#3e2723]">Team creation</h1>
      <p className="mt-3 text-sm text-[#3e2723]/70">
        Only a GPL admin can create a team and assign a captain. If you are the
        captain, open your team from{" "}
        <Link href="/teams" className="font-semibold text-[#1a7f84]">
          Teams
        </Link>{" "}
        (or Profile) to add members.
      </p>
    </div>
  );
}
