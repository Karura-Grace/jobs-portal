import { requireProfile } from "@/lib/auth";
import { PageHead } from "@/components/dashboard-shell";
import {
  Avatar,
  EmptyState,
  TableFrame,
  Td,
  Th,
  Tr,
} from "@/components/dashboard-ui";
import { Users } from "lucide-react";
import { dash } from "@/lib/content";

/**
 * Admin candidate search — "pick a job, see every seeker ranked by match%,
 * not just applicants". Sourcing tool, distinct from the applicant list on
 * each job's own page: this surfaces people who haven't applied yet.
 *
 * candidate_matches() (migration 032) does the ranking in the database and
 * re-checks is_admin() itself — the route guard here is the UI's guard, not
 * the only one.
 */
export default async function AdminCandidates({
  searchParams,
}: {
  searchParams: Promise<{ job?: string; industry?: string }>;
}) {
  const { supabase } = await requireProfile("admin");
  const params = await searchParams;

  const [{ data: jobOptions }, { data: industryOptions }] = await Promise.all([
    supabase
      .from("jobs")
      .select("id, title")
      .not("required_skills", "is", null)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase.from("job_categories").select("id, name").order("name").limit(300),
  ]);

  const jobs = (jobOptions as { id: string; title: string }[] | null) ?? [];
  const industries = (industryOptions as { id: string; name: string }[] | null) ?? [];
  const selectedJobId = params.job && jobs.some((j) => j.id === params.job) ? params.job : null;
  const selectedIndustry =
    params.industry && industries.some((i) => i.id === params.industry) ? params.industry : null;

  const { data: matches } = selectedJobId
    ? await supabase.rpc("candidate_matches", {
        p_job_id: selectedJobId,
        p_industry_category_id: selectedIndustry,
      })
    : { data: null };

  const rows = matches ?? [];

  return (
    <div>
      <PageHead
        eyebrow={dash.common.settings}
        title={dash.admin.candidatesTitle}
        sub={dash.admin.candidatesSub}
      />

      <form method="get" className="clay mb-6 flex flex-wrap items-end gap-3 p-5">
        <div className="min-w-0 flex-1">
          <label htmlFor="job" className="eyebrow mb-2 block">
            {dash.admin.candidatesJobLabel}
          </label>
          <select id="job" name="job" defaultValue={selectedJobId ?? ""} className="field">
            <option value="">{dash.admin.candidatesJobPlaceholder}</option>
            {jobs.map((job) => (
              <option key={job.id} value={job.id}>
                {job.title}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-0 flex-1">
          <label htmlFor="industry" className="eyebrow mb-2 block">
            {dash.seeker.industry}
          </label>
          <select
            id="industry"
            name="industry"
            defaultValue={selectedIndustry ?? ""}
            className="field"
          >
            <option value="">{dash.seeker.selectPlaceholder}</option>
            {industries.map((industry) => (
              <option key={industry.id} value={industry.id}>
                {industry.name}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn-primary">
          {dash.admin.candidatesSearch}
        </button>
      </form>

      {!selectedJobId ? (
        <EmptyState
          icon={Users}
          title={dash.admin.candidatesEmptyTitle}
          body={dash.admin.candidatesEmptyBody}
        />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Users}
          title={dash.admin.candidatesNoneTitle}
          body={dash.admin.candidatesNoneBody}
        />
      ) : (
        <TableFrame>
          <thead>
            <tr>
              <Th>{dash.admin.candidatesColSeeker}</Th>
              <Th>{dash.admin.candidatesColHeadline}</Th>
              <Th className="text-right">{dash.admin.candidatesColMatch}</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <Tr key={row.seeker_id}>
                <Td>
                  <div className="flex items-center gap-3">
                    <Avatar name={row.full_name} src={row.avatar_url} size={32} />
                    <span className="text-ink">{row.full_name ?? "Unnamed"}</span>
                  </div>
                </Td>
                <Td className="text-muted">{row.headline ?? "—"}</Td>
                <Td className="text-right font-mono text-sm text-ink">
                  {row.match_percent}%
                </Td>
              </Tr>
            ))}
          </tbody>
        </TableFrame>
      )}
    </div>
  );
}
