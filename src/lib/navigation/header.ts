export function getAppHeader(
  pathname: string,
  from?: string | null,
): {
  title: string;
  backHref: string | null;
} {
  if (pathname === "/") return { title: "Home", backHref: null };
  if (pathname.startsWith("/live")) return { title: "Live", backHref: null };
  if (pathname === "/matches") return { title: "Matches", backHref: null };
  if (pathname.startsWith("/matches/")) {
    return { title: "Match", backHref: "/matches" };
  }
  if (pathname.startsWith("/tournaments")) {
    return { title: "Tournaments", backHref: null };
  }
  if (pathname === "/teams/register") {
    return { title: "New team", backHref: "/tournaments" };
  }
  if (pathname.startsWith("/teams")) {
    return { title: "Team", backHref: "/tournaments" };
  }
  if (pathname === "/players") return { title: "Players", backHref: null };
  if (pathname.startsWith("/players/")) {
    const teamBack =
      from &&
      /^\/teams\/[0-9a-f-]{36}$/i.test(from)
        ? from
        : "/players";
    return { title: "Player", backHref: teamBack };
  }
  if (pathname.startsWith("/stats")) return { title: "Stats", backHref: null };
  if (pathname.startsWith("/profile")) return { title: "Profile", backHref: null };
  if (pathname.startsWith("/login")) return { title: "Login", backHref: null };
  if (pathname.startsWith("/register")) {
    return { title: "Register", backHref: null };
  }
  if (pathname.startsWith("/verify")) {
    return { title: "Registration", backHref: "/profile" };
  }
  const scoreMatch = pathname.match(/^\/score\/([^/]+)/);
  if (scoreMatch) {
    return { title: "Scoring", backHref: `/matches/${scoreMatch[1]}` };
  }
  if (pathname.startsWith("/scoring")) return { title: "Scoring", backHref: null };
  if (pathname.startsWith("/admin")) {
    return {
      title: "Admin",
      backHref: pathname === "/admin" ? null : "/admin",
    };
  }
  return { title: "GPL", backHref: null };
}
