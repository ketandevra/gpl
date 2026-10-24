import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Geist_Mono, Outfit } from "next/font/google";
import { Suspense } from "react";
import { VerificationLockClient } from "@/components/auth/VerificationLockClient";
import { GuestLoginButton } from "@/components/layout/GuestLoginButton";
import { MobileNavigation } from "@/components/layout/MobileNavigation";
import { NavigationProvider } from "@/components/layout/NavigationProvider";
import { RoutePending } from "@/components/layout/RoutePending";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { PwaProvider } from "@/components/pwa/PwaProvider";
import {
  isVerificationAllowedPath,
  needsVerificationLock,
} from "@/lib/auth/permissions";
import { getCurrentUser, getSessionToken } from "@/lib/auth/session";
import { APP_NAME, APP_SHORT_NAME } from "@/lib/constants";
import { APPLE_SPLASH_SCREENS, splashPath } from "@/lib/pwa/splash";
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
  applicationName: APP_SHORT_NAME,
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  appleWebApp: {
    capable: true,
    title: APP_SHORT_NAME,
    statusBarStyle: "black-translucent",
    startupImage: APPLE_SPLASH_SCREENS.map((screen) => ({
      url: splashPath(screen.width, screen.height),
      media: screen.media,
    })),
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#3e2723",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const [token, user] = await Promise.all([getSessionToken(), getCurrentUser()]);
  const signedIn = Boolean(token);
  const locked = needsVerificationLock(user);
  const pathname = (await headers()).get("x-pathname") ?? "";
  if (locked && pathname && !isVerificationAllowedPath(pathname)) {
    redirect("/verify");
  }

  return (
    <html
      lang="en"
      className={`${outfit.variable} ${geistMono.variable} antialiased`}
    >
      <body className="flex flex-col overflow-hidden">
        <NavigationProvider>
          <VerificationLockClient locked={locked} />
          {locked || !signedIn ? (
            <div className="h-[env(safe-area-inset-top)] shrink-0" />
          ) : (
            <Suspense
              fallback={
                <div className="h-[calc(3rem+env(safe-area-inset-top))] shrink-0 md:h-16" />
              }
            >
              <SiteHeader />
            </Suspense>
          )}
          <main className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
            <RoutePending>{children}</RoutePending>
          </main>
          {locked ? null : signedIn ? (
            <MobileNavigation />
          ) : (
            <GuestLoginButton />
          )}
          <PwaProvider />
        </NavigationProvider>
      </body>
    </html>
  );
}
