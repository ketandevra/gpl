import { AuthForm } from "@/components/auth/AuthForm";

export const metadata = { title: "Login" };

type PageProps = {
  searchParams: Promise<{ next?: string }>;
};

export default async function LoginPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const rawNext =
    params.next && params.next.startsWith("/") ? params.next : "/";
  const nextPath =
    rawNext === "/profile" || rawNext === "/login" || rawNext === "/register"
      ? "/"
      : rawNext;

  return <AuthForm mode="login" nextPath={nextPath} />;
}
