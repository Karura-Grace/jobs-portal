import Link from "next/link";
import { type LucideIcon } from "lucide-react";
import { cn, displayApplicant } from "@/lib/utils";

/**
 * The pieces every dashboard page is assembled from.
 *
 * Server components, all of them — none needs state, and keeping them off the
 * client means a table of 50 rows ships no JavaScript for its own chrome.
 */

/** Clay stat card (brief §8, §9, §10). */
export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  href,
  tone = "default",
}: {
  label: string;
  value: number | string;
  hint?: string;
  icon?: LucideIcon;
  href?: string;
  /** `alert` for a number that means work is waiting. */
  tone?: "default" | "alert";
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="eyebrow">{label}</p>
        {Icon && (
          <Icon
            className={cn(
              "h-4 w-4 shrink-0",
              tone === "alert" ? "text-accent" : "text-faint"
            )}
            aria-hidden
          />
        )}
      </div>
      <p
        className={cn(
          "mt-2 font-display text-[1.75rem] font-700 leading-none tracking-display",
          tone === "alert" && value !== 0 ? "text-accent-text" : "text-ink"
        )}
      >
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
      {hint && <p className="mt-1.5 text-xs leading-snug text-muted">{hint}</p>}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="clay press block p-5 transition-shadow duration-200 ease-out hover:shadow-clay-lifted"
      >
        {body}
      </Link>
    );
  }
  return <div className="clay p-5">{body}</div>;
}

/** Brief §12: every page needs a real empty state. */
export function EmptyState({
  title,
  body,
  action,
  icon: Icon,
}: {
  title: string;
  body?: string;
  action?: React.ReactNode;
  icon?: LucideIcon;
}) {
  return (
    <div className="rounded-clay border border-dashed border-line px-6 py-14 text-center">
      {Icon && <Icon className="mx-auto mb-4 h-7 w-7 text-faint" aria-hidden />}
      <p className="font-display text-lg font-600 text-ink">{title}</p>
      {body && (
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">{body}</p>
      )}
      {action && <div className="mt-6 flex justify-center gap-3">{action}</div>}
    </div>
  );
}

/**
 * Table frame. Tables scroll inside their own container so a narrow viewport
 * never makes the whole page scroll sideways.
 */
export function TableFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="clay overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-sm">{children}</table>
      </div>
    </div>
  );
}

export function Th({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      scope="col"
      className={cn(
        "border-b border-line px-4 py-3 text-left font-mono text-[10px] uppercase tracking-label text-muted",
        className
      )}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  className,
  title,
}: {
  children?: React.ReactNode;
  className?: string;
  /** Tooltip, for a column whose heading cannot carry the caveat. */
  title?: string;
}) {
  return (
    <td className={cn("px-4 py-3 align-middle", className)} title={title}>
      {children}
    </td>
  );
}

/**
 * Makes a whole table row clickable without any JavaScript.
 *
 * The row is `position: relative` and this anchor is stretched across it, so the
 * click target is the entire row while the markup stays a real `<table>` — one
 * tab stop per row, and a screen reader still gets the column headers. Anything
 * interactive in a later cell needs `relative z-10` to sit above it, which is
 * what `Td`'s callers do for action buttons.
 */
export function RowLink({
  href,
  label,
  children,
}: {
  href: string;
  /** Accessible name for the row, since the visible text may be several cells. */
  label: string;
  children?: React.ReactNode;
}) {
  return (
    <Link href={href} scroll={false} aria-label={label} className="group/row">
      <span className="absolute inset-0 rounded-[2px]" aria-hidden />
      {children}
    </Link>
  );
}

/** A row that hosts a RowLink. Hover feedback lives here, not on the anchor. */
export function Tr({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <tr
      className={cn(
        "relative border-b border-line/70 transition-colors duration-150 last:border-0 hover:bg-surface-raised/60",
        className
      )}
    >
      {children}
    </tr>
  );
}

/**
 * Avatar. Falls back to initials rather than a generic silhouette — a letter
 * still tells you which row you are looking at.
 *
 * `src` is a signed URL when it exists (the avatars bucket is private,
 * migration 018), so this is a plain <img>: next/image would need the Supabase
 * host allow-listed and would cache a URL that expires.
 */
export function Avatar({
  name,
  email,
  src,
  size = 36,
}: {
  name?: string | null;
  email?: string | null;
  src?: string | null;
  size?: number;
}) {
  const label = displayApplicant(name ?? null, email ?? null);
  const initials = label
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <span
      className="grid shrink-0 place-items-center overflow-hidden rounded-pill bg-surface-raised font-mono text-[11px] uppercase text-muted ring-1 ring-inset ring-[var(--clay-border)]"
      style={{ width: size, height: size }}
      aria-hidden
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" width={size} height={size} className="h-full w-full object-cover" />
      ) : (
        initials || "?"
      )}
    </span>
  );
}
