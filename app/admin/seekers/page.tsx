import Link from "next/link";
import { Search, Users } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { PageHead } from "@/components/dashboard-shell";
import {
  Avatar,
  EmptyState,
  RowLink,
  TableFrame,
  Td,
  Th,
  Tr,
} from "@/components/dashboard-ui";
import { ToastFromSearchParams } from "@/components/toast-from-search-params";
import { Drawer } from "@/components/drawer";
import { ConfirmAction } from "@/components/confirm-action";
import { CvLink } from "@/components/cv-link";
import { avatarUrls, avatarUrl } from "@/lib/avatar";
import { signSeekerProfileCv } from "@/lib/cv-actions";
import { cvStatus, isLegacyCvUrl } from "@/lib/cv";
import { completeness, profileChecklist } from "@/lib/profile";
import { dash } from "@/lib/content";
import { displayApplicant, timeAgo } from "@/lib/utils";
import { setSuspended } from "../actions";
import type { Profile } from "@/types/database";

const BASE = "/admin/seekers";
const PER_PAGE = 50;

type Params = {
  q?: string;
  state?: string;
  id?: string;
  page?: string;
  updated?: string;
  error?: string;
};

function href(current: Params, changes: Partial<Record<keyof Params, string | null>>) {
  const next = new URLSearchParams();
  const merged = { ...current, ...changes } as Record<string, string | null | undefined>;
  delete merged.updated;
  delete merged.error;
  for (const [key, value] of Object.entries(merged)) if (value) next.set(key, value);
  const qs = next.toString();
  return qs ? `${BASE}?${qs}` : BASE;
}

/**
 * Job seekers (brief §10).
 *
 * The profile-completion percentage uses the same checklist the seeker sees on
 * their own dashboard, so the number an admin reads here is the number the
 * applicant is being asked to improve — not a second, differently-defined one.
 */
export default async function AdminSeekers({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const { supabase } = await requireProfile("admin");
  const params = await searchParams;

  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const from = (page - 1) * PER_PAGE;

  // Explicit column list, not "*". profileChecklist() genuinely needs
  // full_name/phone/headline/skills/address/cv_url for every row on the page
  // (the completeness % is computed per row, not just for whichever one is
  // open in the drawer) — but `bio` and `linkedin_url` are shown nowhere on
  // this page and were being sent for all 50 rows regardless.
  let query = supabase
    .from("profiles")
    .select(
      "id, full_name, email, phone, headline, skills, address, avatar_url, cv_url, suspended_at, created_at, years_experience, education_level, industry_category_id",
      { count: "exact" }
    )
    .eq("role", "seeker")
    .order("created_at", { ascending: false });

  if (params.q) {
    const term = params.q.replace(/[%,()]/g, " ").trim();
    if (term) {
      query = query.or(`full_name.ilike.%${term}%,email.ilike.%${term}%`);
    }
  }
  if (params.state === "suspended") query = query.not("suspended_at", "is", null);
  if (params.state === "active") query = query.is("suspended_at", null);

  const { data, count } = await query.range(from, from + PER_PAGE - 1);
  const rows = (data ?? []) as unknown as Profile[];
  const total = count ?? 0;
  const lastPage = Math.max(1, Math.ceil(total / PER_PAGE));

  const avatars = await avatarUrls(
    supabase,
    rows.map((row) => row.avatar_url)
  );

  // Application counts, one query for the whole page rather than one per row.
  const counts = new Map<string, number>();
  if (rows.length > 0) {
    const { data: apps } = await supabase
      .from("applications")
      .select("applicant_id")
      .in(
        "applicant_id",
        rows.map((r) => r.id)
      );
    for (const app of ((apps as { applicant_id: string | null }[] | null) ?? [])) {
      if (!app.applicant_id) continue;
      counts.set(app.applicant_id, (counts.get(app.applicant_id) ?? 0) + 1);
    }
  }

  // Same batching for the two migration-033 tables that now feed
  // profileChecklist/isProfileGateComplete — existence only, not full rows,
  // one query each for the whole page rather than per row.
  const educationIds = new Set<string>();
  const workExperienceIds = new Set<string>();
  if (rows.length > 0) {
    const ids = rows.map((r) => r.id);
    const [{ data: educationRows }, { data: experienceRows }] = await Promise.all([
      supabase.from("profile_education").select("profile_id").in("profile_id", ids),
      supabase.from("profile_work_experience").select("profile_id").in("profile_id", ids),
    ]);
    for (const row of ((educationRows as { profile_id: string }[] | null) ?? [])) {
      educationIds.add(row.profile_id);
    }
    for (const row of ((experienceRows as { profile_id: string }[] | null) ?? [])) {
      workExperienceIds.add(row.profile_id);
    }
  }

  // DRAWER ------------------------------------------------------------
  const open = params.id ? (rows.find((r) => r.id === params.id) ?? null) : null;
  const openCvStatus = open ? cvStatus(open.cv_url) : "none";
  const openAvatar = open ? await avatarUrl(supabase, open.avatar_url) : null;
  const openProgress = open
    ? completeness(
        profileChecklist(
          open,
          Boolean(open.cv_url) && !isLegacyCvUrl(open.cv_url),
          educationIds.has(open.id),
          workExperienceIds.has(open.id)
        )
      )
    : null;

  return (
    <div>
      <PageHead
        eyebrow="PAC Africa · Internal"
        title={dash.admin.seekersTitle}
        sub={dash.admin.seekersSub}
      />

      <ToastFromSearchParams
        error={params.error}
        success={
          params.updated === "suspended"
            ? "Account suspended."
            : params.updated === "reinstated"
              ? "Account reinstated."
              : null
        }
      />

      <form action={BASE} className="mb-4 flex flex-wrap items-end gap-2.5">
        <div className="relative min-w-[220px] flex-1">
          <label htmlFor="q" className="sr-only">
            Search seekers
          </label>
          <Search
            className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-faint"
            aria-hidden
          />
          <input
            id="q"
            name="q"
            defaultValue={params.q ?? ""}
            placeholder="Name or email address"
            className="field pl-10"
          />
        </div>
        {params.state && <input type="hidden" name="state" value={params.state} />}
        <button type="submit" className="btn-primary shrink-0">
          {dash.common.search}
        </button>
      </form>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        {[
          { value: null, label: "All" },
          { value: "active", label: dash.admin.active },
          { value: "suspended", label: dash.admin.suspended },
        ].map((chip) => (
          <Link
            key={chip.label}
            href={href(params, { state: chip.value, id: null, page: null })}
            className={`chip ${
              (params.state ?? null) === chip.value ? "chip-active" : ""
            }`}
          >
            {chip.label}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No accounts match"
          body="Clear the search, or try part of an email address."
          action={
            <Link href={BASE} className="btn-secondary">
              {dash.common.clear}
            </Link>
          }
        />
      ) : (
        <>
          <TableFrame>
            <thead>
              <tr>
                <Th>{dash.admin.colName}</Th>
                <Th className="w-[110px]">{dash.admin.colJoined}</Th>
                <Th className="w-[100px] text-right">{dash.admin.colSent}</Th>
                <Th className="w-[90px] text-right">{dash.admin.colProfile}</Th>
                <Th className="w-[110px] text-right">{dash.admin.colAccount}</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const name = displayApplicant(row.full_name, row.email);
                const progress = completeness(
                  profileChecklist(
                    row,
                    Boolean(row.cv_url) && !isLegacyCvUrl(row.cv_url),
                    educationIds.has(row.id),
                    workExperienceIds.has(row.id)
                  )
                );
                return (
                  <Tr key={row.id}>
                    <Td>
                      <RowLink href={href(params, { id: row.id })} label={name}>
                        <span className="flex items-center gap-2.5">
                          <Avatar
                            name={row.full_name}
                            email={row.email}
                            src={row.avatar_url ? avatars.get(row.avatar_url) : null}
                            size={30}
                          />
                          <span className="min-w-0">
                            <span className="block truncate font-500 text-ink">
                              {name}
                            </span>
                            <span className="block truncate text-xs text-muted">
                              {row.email}
                            </span>
                          </span>
                        </span>
                      </RowLink>
                    </Td>
                    <Td className="whitespace-nowrap text-xs text-muted">
                      {timeAgo(row.created_at)}
                    </Td>
                    <Td className="text-right font-mono text-xs text-muted">
                      {counts.get(row.id) ?? 0}
                    </Td>
                    <Td className="text-right font-mono text-xs text-muted">
                      {progress.percent}%
                    </Td>
                    <Td className="text-right">
                      {row.suspended_at ? (
                        <span className="rounded-pill bg-red-500/12 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-red-700 dark:text-red-400">
                          {dash.admin.suspended}
                        </span>
                      ) : (
                        <span className="rounded-pill bg-surface-raised px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted">
                          {dash.admin.active}
                        </span>
                      )}
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </TableFrame>

          <div className="mt-4 flex items-center justify-between gap-4">
            <p className="text-xs text-muted">
              {dash.common.showing(from + 1, from + rows.length, total)}
            </p>
            {lastPage > 1 && (
              <div className="flex gap-2">
                {page > 1 && (
                  <Link
                    href={href(params, {
                      page: page === 2 ? null : String(page - 1),
                      id: null,
                    })}
                    className="btn-secondary px-3 py-1.5 text-xs"
                  >
                    {dash.common.prev}
                  </Link>
                )}
                {page < lastPage && (
                  <Link
                    href={href(params, { page: String(page + 1), id: null })}
                    className="btn-secondary px-3 py-1.5 text-xs"
                  >
                    {dash.common.next}
                  </Link>
                )}
              </div>
            )}
          </div>
        </>
      )}

      <Drawer
        open={Boolean(open)}
        closeHref={href(params, { id: null })}
        title={open ? displayApplicant(open.full_name, open.email) : dash.admin.seekersTitle}
      >
        {open && openProgress && (
          <div className="space-y-6">
            <div className="flex items-start gap-3">
              <Avatar
                name={open.full_name}
                email={open.email}
                src={openAvatar}
                size={44}
              />
              <div className="min-w-0">
                <p className="font-display text-base font-600 text-ink">
                  {displayApplicant(open.full_name, open.email)}
                </p>
                {open.headline && (
                  <p className="mt-0.5 text-sm text-muted">{open.headline}</p>
                )}
                <a
                  href={`mailto:${open.email}`}
                  className="mt-0.5 block truncate text-sm text-accent-text hover:opacity-70"
                >
                  {open.email}
                </a>
              </div>
            </div>

            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="eyebrow">Phone</dt>
                <dd className="mt-1 text-ink">{open.phone ?? "—"}</dd>
              </div>
              <div>
                <dt className="eyebrow">Location</dt>
                <dd className="mt-1 text-ink">{open.address ?? "—"}</dd>
              </div>
              <div>
                <dt className="eyebrow">{dash.admin.colJoined}</dt>
                <dd className="mt-1 text-ink">
                  {new Date(open.created_at).toLocaleDateString("en-KE", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </dd>
              </div>
              <div>
                <dt className="eyebrow">{dash.admin.colProfile}</dt>
                <dd className="mt-1 text-ink">
                  {openProgress.percent}% ({openProgress.done}/{openProgress.total})
                </dd>
              </div>
            </dl>

            {open.skills && open.skills.length > 0 && (
              <div>
                <p className="eyebrow mb-2">Skills</p>
                <div className="flex flex-wrap gap-1.5">
                  {open.skills.map((skill) => (
                    <span
                      key={skill}
                      className="rounded-pill bg-surface-raised px-2.5 py-1 text-xs text-ink"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="border-t border-line pt-5">
              <CvLink
                status={openCvStatus}
                onOpen={open ? signSeekerProfileCv.bind(null, open.id) : undefined}
              />
            </div>

            <div className="border-t border-line pt-5">
              <Link
                href={`/admin/applications?q=${encodeURIComponent(open.email)}`}
                className="btn-secondary text-sm"
              >
                {counts.get(open.id) ?? 0} application
                {(counts.get(open.id) ?? 0) === 1 ? "" : "s"}
              </Link>
            </div>

            <div className="border-t border-line pt-5">
              {open.suspended_at ? (
                <ConfirmAction
                  action={setSuspended}
                  fields={{
                    table: "profiles",
                    id: open.id,
                    suspend: "false",
                    return_to: href(params, { id: open.id }),
                  }}
                  trigger={dash.admin.reinstate}
                  triggerClassName="btn-accent px-4 py-2 text-sm"
                  title="Reinstate this account?"
                  body="They can sign in and apply again. Nothing about their history changes."
                  confirmLabel={dash.admin.reinstate}
                />
              ) : (
                <ConfirmAction
                  action={setSuspended}
                  fields={{
                    table: "profiles",
                    id: open.id,
                    suspend: "true",
                    return_to: href(params, { id: open.id }),
                  }}
                  trigger={dash.admin.suspend}
                  triggerClassName="btn-secondary px-4 py-2 text-sm"
                  title={dash.admin.confirmSuspendTitle}
                  body={dash.admin.confirmSuspendBodySeeker}
                  confirmLabel={dash.admin.suspend}
                  tone="danger"
                />
              )}
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}
