"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner } from "sonner";

/** Styled to the clay surface tokens in app/globals.css. */
export function Toaster() {
  const { resolvedTheme } = useTheme();

  return (
    <Sonner
      theme={resolvedTheme === "dark" ? "dark" : "light"}
      position="bottom-center"
      toastOptions={{
        classNames: {
          toast: "clay !border-[--clay-border] !text-ink !gap-2.5",
          title: "!text-sm !font-medium",
          description: "!text-muted",
          actionButton: "!bg-accent !text-[rgb(10_10_10)]",
          cancelButton: "!bg-transparent !text-muted",
          closeButton: "!bg-transparent !border-[--clay-border] !text-muted",
        },
      }}
    />
  );
}
