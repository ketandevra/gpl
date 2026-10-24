"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { isVerificationAllowedPath } from "@/lib/auth/permissions";

export function VerificationLockClient({ locked }: { locked: boolean }) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!locked || !pathname) return;
    if (isVerificationAllowedPath(pathname)) return;
    router.replace("/verify");
  }, [locked, pathname, router]);

  return null;
}