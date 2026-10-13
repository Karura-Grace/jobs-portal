"use client";

import { ThemeProvider as NextThemes, useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { nav } from "@/lib/content";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemes
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemes>
  );
}

/**
 * Theme toggle.
 *
 * Renders a fixed-size placeholder until mounted. The server cannot know the
 * visitor's stored preference, so rendering the "real" icon immediately would
 * either flash the wrong one or trip a hydration mismatch — and swapping in a
 * differently-sized element would shift the nav. Same box, contents appear.
 */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={nav.themeToggle}
      title={nav.themeToggle}
      className={`press grid h-9 w-9 place-items-center rounded-pill text-muted
                  transition-colors duration-150 ease-out
                  hover:bg-surface-raised hover:text-ink ${className}`}
    >
      {mounted ? (
        isDark ? (
          <Sun className="h-4 w-4" aria-hidden />
        ) : (
          <Moon className="h-4 w-4" aria-hidden />
        )
      ) : (
        <span className="h-4 w-4" aria-hidden />
      )}
    </button>
  );
}
