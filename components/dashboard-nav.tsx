"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  Bookmark,
  Briefcase,
  Building2,
  ChevronsLeft,
  Gauge,
  Inbox,
  List,
  MessageSquare,
  Search,
  Send,
  Settings,
  Shield,
  User,
  UserCheck,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { navFor, roleLabel, type NavIcon, type NavItem } from "@/lib/dashboard-nav";
import type { UserRole } from "@/types/database";

/**
 * Dashboard navigation — brief §13.
 *
 * Two presentations of one nav list:
 *
 *  - Desktop (lg+): a sticky sidebar that collapses to icons only. The collapsed
 *    state persists in localStorage, because a preference that resets on every
 *    navigation is not a preference. Read in an effect rather than during
 *    render so the server and first client render agree.
 *
 *  - Mobile: a fixed bottom tab bar of the four `primary` items. Bottom rather
 *    than a hamburger — these are the destinations people actually move between,
 *    and on a phone they belong under the thumb. Everything else stays reachable
 *    from the pages themselves.
 *
 * The active item is matched by prefix, except for the overview links, where the
 * href is a prefix of every sibling and would light up permanently.
 */

const ICONS: Record<NavIcon, typeof Gauge> = {
  gauge: Gauge,
  search: Search,
  send: Send,
  bookmark: Bookmark,
  user: User,
  settings: Settings,
  briefcase: Briefcase,
  inbox: Inbox,
  message: MessageSquare,
  building: Building2,
  shield: Shield,
  list: List,
  users: Users,
  userCheck: UserCheck,
  bell: Bell,
};

const STORE_KEY = "pac.dash.collapsed";

function isActive(pathname: string, item: NavItem, items: NavItem[]) {
  // An overview href ("/dashboard/seeker") prefixes all of its siblings, so it
  // only counts as active on an exact match.
  const isOverview = items.some((o) => o !== item && o.href.startsWith(`${item.href}/`));
  if (isOverview) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function DashboardNav({ role, name }: { role: UserRole; name?: string }) {
  const pathname = usePathname();
  const items = navFor(role);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(window.localStorage.getItem(STORE_KEY) === "1");
  }, []);

  const toggle = () => {
    setCollapsed((was) => {
      window.localStorage.setItem(STORE_KEY, was ? "0" : "1");
      return !was;
    });
  };

  const primary = items.filter((i) => i.primary);

  return (
    <>
      {/* DESKTOP SIDEBAR ------------------------------------------------ */}
      <aside
        className={cn(
          "hidden shrink-0 lg:block",
          // Width is the only thing that animates; the labels cross-fade with
          // it. Transitioning width is normally a sin, but this is a one-off
          // deliberate toggle on a container with no siblings to reflow, and
          // the alternative — a transform — would drag the page content with it.
          collapsed ? "lg:w-[68px]" : "lg:w-[212px]",
          "transition-[width] duration-200 ease-out"
        )}
      >
        <div className="sticky top-24">
          <div
            className={cn(
              "mb-4 flex items-center gap-2 px-2",
              collapsed && "justify-center px-0"
            )}
          >
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="eyebrow">{roleLabel[role]}</p>
                {name && (
                  <p className="truncate text-sm font-500 text-ink" title={name}>
                    {name}
                  </p>
                )}
              </div>
            )}
            <button
              type="button"
              onClick={toggle}
              aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
              aria-expanded={!collapsed}
              className="press grid h-8 w-8 shrink-0 place-items-center rounded-pill text-muted transition-colors duration-150 hover:bg-surface-raised hover:text-ink"
            >
              <ChevronsLeft
                className={cn(
                  "h-4 w-4 transition-transform duration-200 ease-out",
                  collapsed && "rotate-180"
                )}
                aria-hidden
              />
            </button>
          </div>

          <nav aria-label="Dashboard" className="flex flex-col gap-0.5">
            {items.map((item) => {
              const Icon = ICONS[item.icon];
              const active = isActive(pathname, item, items);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    "press group relative flex items-center gap-3 rounded-card px-2.5 py-2 text-sm transition-colors duration-150",
                    collapsed && "justify-center px-0",
                    active
                      ? "bg-surface-raised font-500 text-ink"
                      : "text-muted hover:bg-surface-raised/60 hover:text-ink"
                  )}
                >
                  {/* Active marker on the leading edge — reads at a glance in
                      both widths, unlike a background tint alone. */}
                  <span
                    aria-hidden
                    className={cn(
                      "absolute left-0 top-1/2 h-5 w-[2.5px] -translate-y-1/2 rounded-r bg-accent transition-opacity duration-150",
                      active ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <Icon className="h-4 w-4 shrink-0" aria-hidden />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                  {collapsed && <span className="sr-only">{item.label}</span>}
                </Link>
              );
            })}
          </nav>
        </div>
      </aside>

      {/* MOBILE TAB BAR ------------------------------------------------- */}
      <nav
        aria-label="Dashboard"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/85 backdrop-blur-xl lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <ul className="mx-auto grid max-w-md grid-cols-4">
          {primary.map((item) => {
            const Icon = ICONS[item.icon];
            const active = isActive(pathname, item, items);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "press flex flex-col items-center gap-1 px-1 py-2.5 text-[11px] transition-colors duration-150",
                    active ? "text-accent-text" : "text-muted"
                  )}
                >
                  <Icon
                    className="h-[18px] w-[18px]"
                    strokeWidth={active ? 2.4 : 2}
                    aria-hidden
                  />
                  <span className="truncate">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
