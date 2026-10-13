import Link from "next/link";
import { Building2, Search } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { PageHead } from "@/components/dashboard-shell";
import {
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
import { JobStatusBadge } from "@/components/status-badge";
import { dash } from "@/lib/content";
import { logoUrl } from "@/lib/avatar";
import { timeAgo } from "@/lib/utils";
import { setCompanyVerified, setSuspended } from "../actions";
import type { JobStatus } from "@/types/database";

const BASE = "/admin/employers";

type Params = { q?: string; state?: string; id?: string; updated?: string; error?: string };

function href(current: Params, changes: Partial<Record<keyof Params, string | null>>) {
  const next = new URLSearchParams();
  const merged = { ...current, ...changes } as Record<string, string | null | undefined>;
  delete merged.updated;
  delete merged.error;
  for (const [key, value] of Object.entries(merged)) if (value) next.set(key, value);
  const qs = next.toString();
  return qs ? `${BASE}?${qs}` : BASE;
}

interface Row {
  id: string;
  name: string;
  slug: string;
  industry: string | null;
  location: string | null;
  website: string | null;
  description: string | null;
  logo_url: string | null;
  verified: boolean;
  suspended_at: string | null;
  created_at: string;
  owner_id: string | null;
  jobs: { count: number }[];
}

interface JobRow {
  id: string;
  title: string;
  status: JobStatus;
  created_at: string;
  applications: { count: number }[];
}

/**
 * Employers (brief §10).
 *
 * The row count is every listing, not only the live ones — an employer with
 * eleven drafts and nothing published is exactly the account worth looking at,
 * and a "0" would hide them.
 */
export default async function AdminEmployers({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const { supabase } = await requireProfile("admin");
  const params = await searchParams;

  let query = supabase
    .from("companies")
    .select(
      `id, name, slug, industry, location, website, description, logo_url, verified,
       suspended_at, created_at, owner_id, jobs(count)`
    )
    .order("created_at", { ascending: false })
    .limit(300);

  if (params.q) {
    const term = params.q.replace(/[%,()]/g, " ").trim();
    if (term) query = query.ilike("name", `%${term}%`);
  }
  if (params.state === "suspended") query = query.not("suspended_at", "is", null);
  if (params.state === "active") query = query.is("suspended_at", null);
  if (params.state === "unverified") query = query.eq("verified", false);

  const { data } = await query;
  const rows = (data ?? []) as unknown as Row[];

  // DRAWER: the employer's own listings, which is what an admin needs before
  // deciding whether to suspend.
  const open = params.id ? (rows.find((r) => r.id === params.id) ?? null) : null;
  let openJobs: JobRow[] = [];
  let received = 0;

  if (open) {
    const [{ data: jobs }, { data: jobIds }] = await Promise.all([
      supabase
        .from("jobs")
        .select("id, title, status, created_at, applications(count)")
        .eq("company_id", open.id)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase.from("jobs").select("id").eq("company_id", open.id),
    ]);
    openJobs = (jobs ?? []) as unknown as JobRow[];

    const ids = ((jobIds as { id: string }[] | null) ?? []).map((j) => j.id);
    if (ids.length > 0) {
      const { count } = await supabase
        .from("applications")
        .select("id", { count: "exact", head: true })
        .in("job_id", ids);
      received = count ?? 0;
    }
  }

  return (
    <div>
      <PageHead
        eyebrow="PAC Africa · Internal"
        title={dash.admin.employersTitle}
        sub={dash.admin.employersSub}
      />

      <ToastFromSearchParams
        error={params.error}
        success={
          params.updated === "suspended"
            ? "Employer suspended. Their listings are no longer public."
            : params.updated === "reinstated"
              ? "Employer reinstated."
              : params.updated === "verification"
                ? "Verification updated."
                : null
        }
      />

      <form action={BASE} className="mb-4 flex flex-wrap items-end gap-2.5">
        <div className="relative min-w-[220px] flex-1">
          <label htmlFor="q" className="sr-only">
            Search employers
          </label>
          <Search
            className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-faint"
            aria-hidden
          />
          <input
            id="q"
            name="q"
            defaultValue={params.q ?? ""}
            placeholder="Company name"
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
          { value: "unverified", label: "Unverified" },
        ].map((chip) => (
          <Link
            key={chip.label}
            href={href(params, { state: chip.value, id: null })}
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
          icon={Building2}
          title="No employers match"
          body="Clear the filters, or add a company from the job form when you enter a listing on someone's behalf."
          action={
            <Link href={BASE} className="btn-secondary">
              {dash.common.clear}
            </Link>
          }
        />
      ) : (
        <TableFrame>
          <thead>
            <tr>
              <Th>{dash.admin.colCompany}</Th>
              <Th className="w-[120px]">{dash.admin.colJoined}</Th>
              <Th className="w-[90px] text-right">Listings</Th>
              <Th className="w-[110px] text-right">{dash.admin.colAccount}</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <Tr key={row.id}>
                <Td>
                  <RowLink href={href(params, { id: row.id })} label={row.name}>
                    <span className="block truncate font-500 text-ink">{row.name}</span>
                    <span className="block truncate text-xs text-muted">
                      {row.industry ?? "Industry not set"}
                      {row.location ? ` · ${row.location}` : ""}
                      {!row.owner_id && " · no account linked"}
                    </span>
                  </RowLink>
                </Td>
                <Td className="whitespace-nowrap text-xs text-muted">
                  {timeAgo(row.created_at)}
                </Td>
                <Td className="text-right font-mono text-xs text-muted">
                  {row.jobs?.[0]?.count ?? 0}
                </Td>
                <Td className="text-right">
                  {row.suspended_at ? (
                    <span className="rounded-pill bg-red-500/12 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-red-700 dark:text-red-400">
                      {dash.admin.suspended}
                    </span>
                  ) : row.verified ? (
                    <span className="rounded-pill bg-emerald-500/12 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                      Verified
                    </span>
                  ) : (
                    <span className="rounded-pill bg-surface-raised px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted">
                      {dash.admin.active}
                    </span>
                  )}
                </Td>
              </Tr>
            ))}
          </tbody>
        </TableFrame>
      )}

      <Drawer
        open={Boolean(open)}
        closeHref={href(params, { id: null })}
        title={open?.name ?? dash.admin.employersTitle}
      >
        {open && (
          <div className="space-y-6">
            <div className="flex items-start gap-3">
              <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-card bg-surface-raised font-mono text-xs uppercase text-muted">
                {logoUrl(supabase, open.logo_url) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={logoUrl(supabase, open.logo_url) as string}
                    alt=""
                    className="h-full w-full object-contain"
                  />
                ) : (
                  open.name.slice(0, 2)
                )}
              </span>
              <div className="min-w-0">
                <p className="font-display text-base font-600 text-ink">{open.name}</p>
                <p className="mt-0.5 text-sm text-muted">
                  {open.industry ?? "Industry not set"}
                  {open.location ? ` · ${open.location}` : ""}
                </p>
                {open.website && (
                  <a
                    href={open.website}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="mt-0.5 block truncate text-sm text-accent-text hover:opacity-70"
                  >
                    {open.website}
                  </a>
                )}
              </div>
            </div>

            {open.description && (
              <p className="text-sm leading-relaxed text-ink/90">{open.description}</p>
            )}

            <dl className="grid grid-cols-2 gap-4 border-t border-line pt-5 text-sm">
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
                <dt className="eyebrow">{dash.admin.colReceived}</dt>
                <dd className="mt-1 text-ink">{received.toLocaleString()}</dd>
              </div>
            </dl>

            <div className="border-t border-line pt-5">
              <p className="eyebrow mb-3">Listings</p>
              {openJobs.length === 0 ? (
                <p className="text-sm text-faint">Nothing posted yet.</p>
              ) : (
                <ul className="space-y-2">
                  {openJobs.map((job) => (
                    <li key={job.id} className="flex items-center justify-between gap-3">
                      <Link
                        href={`/admin/jobs/${job.id}/edit`}
                        className="min-w-0 flex-1 truncate text-sm text-ink hover:text-accent-text"
                      >
                        {job.title}
                      </Link>
                      <span className="shrink-0 font-mono text-xs text-muted">
                        {job.applications?.[0]?.count ?? 0}
                      </span>
                      <JobStatusBadge status={job.status} />
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* ACTIONS -------------------------------------------------- */}
            <div className="flex flex-wrap items-center gap-2 border-t border-line pt-5">
              {open.suspended_at ? (
                <ConfirmAction
                  action={setSuspended}
                  fields={{
                    table: "companies",
                    id: open.id,
                    suspend: "false",
                    return_to: href(params, { id: open.id }),
                  }}
                  trigger={dash.admin.reinstate}
                  triggerClassName="btn-accent px-4 py-2 text-sm"
                  title="Reinstate this employer?"
                  body="Their listings become publicly visible again, in whatever status each one already had."
                  confirmLabel={dash.admin.reinstate}
                />
              ) : (
                <ConfirmAction
                  action={setSuspended}
                  fields={{
                    table: "companies",
                    id: open.id,
                    suspend: "true",
                    return_to: href(params, { id: open.id }),
                  }}
                  trigger={dash.admin.suspend}
                  triggerClassName="btn-secondary px-4 py-2 text-sm"
                  title={dash.admin.confirmSuspendTitle}
                  body={dash.admin.confirmSuspendBodyEmployer}
                  confirmLabel={dash.admin.suspend}
                  tone="danger"
                />
              )}

              <form action={setCompanyVerified}>
                <input type="hidden" name="company_id" value={open.id} />
                <input
                  type="hidden"
                  name="verified"
                  value={open.verified ? "false" : "true"}
                />
                <input
                  type="hidden"
                  name="return_to"
                  value={href(params, { id: open.id })}
                />
                <button type="submit" className="btn-ghost border-line text-sm">
                  {open.verified ? "Remove verification" : "Verify employer"}
                </button>
              </form>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}
