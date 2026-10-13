"use client";

import { useRef } from "react";
import { useFormStatus } from "react-dom";
import { applicationStatusLabels } from "@/lib/content";
import { dash } from "@/lib/content";
import type { ApplicationStatus } from "@/types/database";

/**
 * The status selector in the employer drawer.
 *
 * A `<select>` that submits on change, so the interaction is one gesture rather
 * than pick-then-press. The submit button stays in the markup for anyone without
 * JavaScript — it is hidden from sighted users only once the change handler can
 * do the work.
 *
 * `useFormStatus` gives the pending state, so the control disables itself while
 * the round trip is in flight instead of accepting a second change that would
 * race the first.
 */
const STATUSES: ApplicationStatus[] = [
  "pending",
  "under_review",
  "shortlisted",
  "rejected",
  "hired",
];

export function StatusSelect({
  applicationId,
  current,
  returnTo,
  action,
}: {
  applicationId: string;
  current: ApplicationStatus;
  returnTo: string;
  action: (formData: FormData) => void | Promise<void>;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={action} className="flex items-center gap-2">
      <input type="hidden" name="application_id" value={applicationId} />
      <input type="hidden" name="return_to" value={returnTo} />
      <Select current={current} onPick={() => formRef.current?.requestSubmit()} />
    </form>
  );
}

function Select({
  current,
  onPick,
}: {
  current: ApplicationStatus;
  onPick: () => void;
}) {
  const { pending } = useFormStatus();

  return (
    <>
      <label htmlFor="status" className="sr-only">
        {dash.drawer.statusLabel}
      </label>
      <select
        id="status"
        name="status"
        defaultValue={current}
        disabled={pending}
        onChange={onPick}
        className="field w-auto min-w-[170px] disabled:opacity-60"
      >
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {applicationStatusLabels[s]}
          </option>
        ))}
      </select>
      {/* Kept for no-JS; the change handler above is the normal path. */}
      <noscript>
        <button type="submit" className="btn-secondary px-3 py-1.5 text-xs">
          {dash.common.apply}
        </button>
      </noscript>
    </>
  );
}

/** Internal notes. Separate form so saving a note never touches the status. */
export function NoteForm({
  applicationId,
  current,
  returnTo,
  action,
}: {
  applicationId: string;
  current: string | null;
  returnTo: string;
  action: (formData: FormData) => void | Promise<void>;
}) {
  return (
    <form action={action} className="space-y-2.5">
      <input type="hidden" name="application_id" value={applicationId} />
      <input type="hidden" name="return_to" value={returnTo} />
      <label htmlFor="employer_note" className="sr-only">
        {dash.drawer.notesLabel}
      </label>
      <textarea
        id="employer_note"
        name="employer_note"
        rows={3}
        defaultValue={current ?? ""}
        placeholder="Spoke to her on Tuesday, available from March."
        className="field resize-y"
      />
      <SaveNote />
    </form>
  );
}

function SaveNote() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-secondary px-3 py-1.5 text-xs">
      {pending ? "Saving…" : dash.drawer.notesSave}
    </button>
  );
}
