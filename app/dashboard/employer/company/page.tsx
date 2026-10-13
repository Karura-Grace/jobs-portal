import { requireProfile } from "@/lib/auth";
import { PageHead } from "@/components/dashboard-shell";
import { ToastFromSearchParams } from "@/components/toast-from-search-params";
import { IMAGE_ACCEPT, logoUrl } from "@/lib/avatar";
import { dash } from "@/lib/content";
import { upsertCompany, uploadLogo } from "../actions";
import type { Company } from "@/types/database";

const SIZES = ["1-10", "11-50", "51-200", "201-500", "500+"];

/** Brief §9: "About us (short text, 300 char limit)". */
const ABOUT_LIMIT = 300;

export default async function CompanyProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; logo?: string; error?: string }>;
}) {
  const { supabase, profile } = await requireProfile("employer");
  const params = await searchParams;

  let company: Company | null = null;
  if (profile.company_id) {
    const { data } = await supabase
      .from("companies")
      .select("*")
      .eq("id", profile.company_id)
      .single();
    company = (data as Company) ?? null;
  }

  const logo = logoUrl(supabase, company?.logo_url);

  return (
    <div>
      <PageHead
        eyebrow="Employer"
        title={company ? dash.employer.companyTitle : "Add your company"}
        sub={dash.employer.companySub}
      />

      <ToastFromSearchParams
        error={params.error}
        success={
          params.error
            ? null
            : params.logo
              ? "Logo updated."
              : params.saved
                ? "Company profile saved."
                : null
        }
      />

      {/* LOGO — only once the company row exists, because the object path is
          keyed on its id (migration 018). */}
      {company && (
        <section className="clay mb-8 p-6">
          <h2 className="font-display text-lg font-600 text-ink">Logo</h2>
          <p className="mb-4 mt-1 max-w-lg text-sm text-muted">
            Used by PAC Africa internally and on your own dashboard. It does not appear on
            your listings — applicants do not see which employer a role belongs to.
          </p>
          <form action={uploadLogo} className="flex flex-wrap items-center gap-4">
            <span className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-card bg-surface-raised font-mono text-xs uppercase text-muted">
              {logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logo}
                  alt=""
                  width={56}
                  height={56}
                  className="h-full w-full object-contain"
                />
              ) : (
                company.name.slice(0, 2)
              )}
            </span>
            <label htmlFor="logo" className="sr-only">
              Choose a logo
            </label>
            <input
              id="logo"
              type="file"
              name="logo"
              accept={IMAGE_ACCEPT}
              required
              className="min-w-0 flex-1 text-sm text-ink file:mr-3 file:cursor-pointer file:rounded-card file:border file:border-line file:bg-surface-raised file:px-3 file:py-2 file:text-sm file:font-medium file:text-ink hover:file:border-accent"
            />
            <button type="submit" className="btn-secondary shrink-0">
              {company.logo_url ? "Replace logo" : "Upload logo"}
            </button>
          </form>
          <p className="mt-2 text-xs text-muted">JPEG, PNG or WebP, up to 2MB.</p>
        </section>
      )}

      <form action={upsertCompany} className="clay max-w-2xl space-y-5 p-6">
        <div>
          <label htmlFor="name" className="eyebrow mb-2 block">
            Company name *
          </label>
          <input
            id="name"
            name="name"
            required
            defaultValue={company?.name ?? ""}
            className="field"
          />
        </div>

        <div>
          <label htmlFor="description" className="eyebrow mb-2 block">
            About us
          </label>
          <textarea
            id="description"
            name="description"
            rows={4}
            maxLength={ABOUT_LIMIT}
            defaultValue={company?.description ?? ""}
            aria-describedby="description-hint"
            className="field resize-y"
          />
          <p id="description-hint" className="mt-1.5 text-xs text-muted">
            Up to {ABOUT_LIMIT} characters. One paragraph on what the company does.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="industry" className="eyebrow mb-2 block">
              Industry
            </label>
            <input
              id="industry"
              name="industry"
              defaultValue={company?.industry ?? ""}
              className="field"
            />
          </div>
          <div>
            <label htmlFor="location" className="eyebrow mb-2 block">
              Head office
            </label>
            <input
              id="location"
              name="location"
              placeholder="e.g. Nairobi"
              defaultValue={company?.location ?? ""}
              className="field"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="size" className="eyebrow mb-2 block">
              Headcount
            </label>
            <select
              id="size"
              name="size"
              defaultValue={company?.size ?? ""}
              className="field"
            >
              <option value="">Not specified</option>
              {SIZES.map((s) => (
                <option key={s} value={s}>
                  {s} people
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="website" className="eyebrow mb-2 block">
              Website
            </label>
            <input
              id="website"
              name="website"
              type="url"
              placeholder="https://…"
              defaultValue={company?.website ?? ""}
              className="field"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 border-t border-line pt-5">
          <button type="submit" className="btn-accent">
            {company ? dash.common.save : "Create company profile"}
          </button>
          {company && (
            <span className="text-xs text-muted">
              {company.verified
                ? "Verified by PAC Africa"
                : "Verification is granted by PAC Africa, not self-set"}
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
