"use client";

import { usePathname } from "next/navigation";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type NavigationContextValue = {
  pendingPath: string | null;
  setPendingPath: (path: string | null) => void;
  displayPath: string;
};

const NavigationContext = createContext<NavigationContextValue>({
  pendingPath: null,
  setPendingPath: () => {},
  displayPath: "/",
});

export function NavigationProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/";
  const [pendingPath, setPendingPath] = useState<string | null>(null);

  useEffect(() => {
    setPendingPath(null);
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [pathname]);

  useEffect(() => {
    function markPending(event: Event) {
      if (!(event instanceof MouseEvent) && !(event instanceof PointerEvent)) {
        return;
      }
      if ("button" in event && event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }
      const target = (event.target as HTMLElement | null)?.closest("a");
      if (!target) return;
      const href = target.getAttribute("href");
      if (
        !href ||
        href.startsWith("http") ||
        href.startsWith("#") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:")
      ) {
        return;
      }
      if (target.target === "_blank") return;
      const next = href.split("?")[0] || "/";
      if (next !== pathname) setPendingPath(next);
    }
    document.addEventListener("click", markPending, true);
    return () => document.removeEventListener("click", markPending, true);
  }, [pathname]);

  const value = useMemo(
    () => ({
      pendingPath,
      setPendingPath,
      displayPath: pendingPath ?? pathname,
    }),
    [pendingPath, pathname],
  );

  return (
    <NavigationContext.Provider value={value}>
      <div className="flex h-full min-h-0 flex-1 flex-col">
        {children}
      </div>
    </NavigationContext.Provider>
  );
}

export function useNavigation() {
  return useContext(NavigationContext);
}
