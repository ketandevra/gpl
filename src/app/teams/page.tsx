import { redirect } from "next/navigation";

type PageProps = {
  searchParams: Promise<{ requested?: string }>;
};

export default async function TeamsPage({ searchParams }: PageProps) {
  const query = await searchParams;
  if (query.requested) redirect("/tournaments?requested=1");
  redirect("/tournaments");
}
