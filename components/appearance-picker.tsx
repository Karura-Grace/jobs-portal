"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Laptop, Moon, Sun } from "lucide-react";

const OPTIONS = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Laptop },
] as const;

/**
 * Explicit light/dark/system picker for Settings, alongside the icon-only
 * toggle already in the nav — same next-themes state, just discoverable and
 * named for someone who wants "system" rather than the binary flip.
 */
export function AppearancePicker({ className = "" }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div className={`flex gap-2 ${className}`}>
      {OPTIONS.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          onClick={() => setTheme(value)}
          aria-pressed={mounted && theme === value}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-card border px-3 py-2 text-sm transition-colors duration-150 ease-out ${
            mounted && theme === value
              ? "border-accent bg-accent/[0.08] text-ink"
              : "border-line text-muted hover:text-ink"
          }`}
        >
          <Icon className="h-4 w-4" aria-hidden />
          {label}
        </button>
      ))}
    </div>
  );
}
