import { redirect } from "next/navigation";

export const metadata = { title: "Admin · Scoring" };

/** Admin alias — scoring hub lives at /scoring for scorers + admins. */
export default function AdminScoringRedirect() {
  redirect("/scoring");
}
