import { redirect } from "next/navigation";
import { BackLink } from "@/components/ui/BackLink";
import { RegisterTeamForm } from "@/components/teams/RegisterTeamForm";
import { getCurrentUser } from "@/lib/auth/session";
import { canAccessAdmin } from "@/lib/auth/permissions";
import { getPendingOwnerRequestForUser } from "@/lib/teams/owner-requests";
import { getActiveTournament, listTeamsForCaptain } from "@/lib/teams/queries";

export const metadata = { title: "Become a team owner" };
export const dynamic = "force-dynamic";

export default async function RegisterTeamPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/teams/register");
  if (canAccessAdmin(user)) redirect("/admin/teams");
  if (user.verification_status !== "verified") {
    redirect("/verify");
  }

  const tournament = await getActiveTournament();
  if (tournament) {
    const mine = await listTeamsForCaptain(user.id);
    if (mine[0]) redirect(`/teams/${mine[0].id}`);
    const pending = await getPendingOwnerRequestForUser(user.id, tournament.id);
    if (pending) {
      return (
        <div className="mx-auto max-w-lg px-4 py-10">
          <BackLink href="/teams">Back to teams</BackLink>
          <h1 className="mt-5 text-2xl font-bold text-[#3e2723]">
            Request pending
          </h1>
          <p className="mt-3 text-sm text-[#3e2723]/70">
            Your request for “{pending.name}” is waiting for admin approval.
            The team will be created only after they approve it.
          </p>
        </div>
      );
    }
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <BackLink href="/teams">Back to teams</BackLink>
      <h1 className="mt-5 text-2xl font-bold text-[#3e2723]">
        Become a team owner
      </h1>
      <p className="mt-3 text-sm text-[#3e2723]/70">
        Enter your team name. You will be the captain. Admin must approve the
        request before the team is created.
      </p>
      <RegisterTeamForm />
    </div>
  );
}
