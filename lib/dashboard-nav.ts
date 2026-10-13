import type { UserRole } from "@/types/database";

/**
 * Dashboard navigation, per role (brief §8, §9, §10).
 *
 * Icons are named rather than imported so this stays a plain data module usable
 * from server components; the client shell maps the name to a lucide component.
 * Importing icons here would drag them into every server bundle that reads the
 * nav.
 *
 * `primary` marks the four items that become the mobile bottom tab bar. The
 * rest move behind the hamburger — which is why the ordering matters and is not
 * alphabetical.
 */
export type NavIcon =
  | "gauge"
  | "search"
  | "send"
  | "bookmark"
  | "user"
  | "settings"
  | "briefcase"
  | "inbox"
  | "message"
  | "building"
  | "shield"
  | "list"
  | "users"
  | "userCheck"
  | "bell";

export type NavItem = {
  href: string;
  label: string;
  icon: NavIcon;
  /** In the mobile bottom tab bar. Exactly four per role. */
  primary?: boolean;
  /** Full-page navigation out of the dashboard. */
  external?: boolean;
};

const seeker: NavItem[] = [
  { href: "/dashboard/seeker", label: "Overview", icon: "gauge", primary: true },
  { href: "/dashboard/seeker/applications", label: "Applications", icon: "send", primary: true },
  { href: "/dashboard/seeker/saved", label: "Saved", icon: "bookmark", primary: true },
  { href: "/dashboard/seeker/profile", label: "Profile", icon: "user", primary: true },
  { href: "/jobs", label: "Browse jobs", icon: "search", external: true },
  { href: "/dashboard/seeker/alerts", label: "Job Alerts", icon: "bell" },
  { href: "/dashboard/seeker/settings", label: "Settings", icon: "settings" },
];

const employer: NavItem[] = [
  { href: "/dashboard/employer", label: "Overview", icon: "gauge", primary: true },
  { href: "/dashboard/employer/jobs", label: "My Jobs", icon: "briefcase", primary: true },
  { href: "/dashboard/employer/applications", label: "Applications", icon: "inbox", primary: true },
  { href: "/dashboard/employer/company", label: "Company", icon: "building", primary: true },
  { href: "/dashboard/employer/messages", label: "Messages", icon: "message" },
  { href: "/dashboard/employer/settings", label: "Settings", icon: "settings" },
];

const admin: NavItem[] = [
  { href: "/admin", label: "Overview", icon: "gauge", primary: true },
  { href: "/admin/moderation", label: "Moderation", icon: "shield", primary: true },
  { href: "/admin/jobs", label: "All Jobs", icon: "list", primary: true },
  { href: "/admin/applications", label: "Applications", icon: "inbox", primary: true },
  { href: "/admin/employers", label: "Employers", icon: "building" },
  { href: "/admin/seekers", label: "Seekers", icon: "users" },
  { href: "/admin/candidates", label: "Find Candidates", icon: "userCheck" },
  { href: "/admin/settings", label: "Settings", icon: "settings" },
];

export function navFor(role: UserRole): NavItem[] {
  if (role === "admin") return admin;
  if (role === "employer") return employer;
  return seeker;
}

export const roleLabel: Record<UserRole, string> = {
  seeker: "Job Seeker",
  employer: "Employer",
  admin: "Administrator",
};
