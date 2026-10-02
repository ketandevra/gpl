import type { Metadata, Viewport } from "next";
import { Geist_Mono, Outfit } from "next/font/google";
import { MobileNavigation } from "@/components/layout/MobileNavigation";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { getCurrentUser } from "@/lib/auth/session";
import { APP_NAME, APP_SHORT_NAME, LOGO_PATH } from "@/lib/constants";
import { hasLiveMatches } from "@/lib/matches/live";
import { countPendingInvitesForUser } from "@/lib/teams/invites";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-display",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: `${APP_SHORT_NAME} · ${APP_NAME}`,
    template: `%s · ${APP_SHORT_NAME}`,
  },
  description:
    "Ghanchi Premier League — live scores, teams, players, and tournament stats.",
  icons: {
    icon: LOGO_PATH,
    apple: LOGO_PATH,
  },
  appleWebApp: {
    capable: true,
    title: APP_SHORT_NAME,
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fdf6e8" },
    { media: "(prefers-color-scheme: dark)", color: "#3e2723" },
  ],
};

export const revalidate = 30;
export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const [hasLive, user] = await Promise.all([
    hasLiveMatches(),
    getCurrentUser(),
  ]);
  const inviteCount = user ? await countPendingInvitesForUser(user.id) : 0;

  return (
    <html
      lang="en"
      className={`${outfit.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <SiteHeader hasLive={hasLive} user={user} inviteCount={inviteCount} />
        <main className="flex-1 pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-8">
          {children}
        </main>
        <MobileNavigation />
      </body>
    </html>
  );
}
