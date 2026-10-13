/**
 * Supabase auth errors, in words an applicant can act on.
 *
 * The raw messages are written for developers. "captcha protection: request
 * disallowed (invalid-input-response)" tells a job seeker nothing, and the
 * captcha ones in particular are the difference between "try again" and "this
 * site is misconfigured, stop trying".
 *
 * Deliberately does NOT distinguish "no account with that email" from "wrong
 * password". Telling them apart is a user-enumeration oracle: it lets anyone
 * check which of 4,355 recovered email addresses have accounts here.
 */
export function authErrorMessage(raw: string): string {
  const message = raw.toLowerCase();

  if (message.includes("work_email_required")) {
    // Backstop branch for migration 031's trigger exception, reached only if
    // someone bypasses the client-side check in lib/employer-email.ts (e.g. a
    // direct API call). Not confirmed against the live project whether
    // Supabase passes this text through verbatim or wraps it in a generic
    // "Database error saving new user" — see migrations/031's plan notes.
    return "Please sign up with your work email address rather than a personal one.";
  }
  if (message.includes("captcha")) {
    // Every captcha failure mode looks the same to the person in front of it,
    // and all of them are fixed by trying again with a fresh challenge — except
    // a provider mismatch, which no amount of retrying fixes. Both get the same
    // sentence because the difference is ours to resolve, not theirs.
    return "The security check did not pass. Please tick it again and retry.";
  }
  if (message.includes("invalid login credentials")) {
    return "That email address and password do not match an account.";
  }
  if (message.includes("email not confirmed")) {
    return "Please open the confirmation link we emailed you before signing in.";
  }
  if (message.includes("user already registered") || message.includes("already been registered")) {
    // This branch IS a user-enumeration oracle, and it is currently unreachable:
    // with "Confirm email" on, Supabase returns an obfuscated success for an
    // existing address rather than this error. It becomes live the day email
    // confirmation is switched off — which migration 006 depends on staying on,
    // since it treats a confirmed address as proof of ownership before releasing
    // application history. If that setting ever changes, delete this branch.
    return "There is already an account with that email address. Try signing in.";
  }
  if (message.includes("password should be at least")) {
    return "Please use a longer password.";
  }
  if (message.includes("weak password") || message.includes("pwned")) {
    // Supabase's leaked-password check. Worth saying why, so it does not read as
    // an arbitrary refusal.
    return "That password appears in a known data breach. Please choose a different one.";
  }
  if (message.includes("rate limit") || message.includes("too many requests")) {
    return "Too many attempts. Please wait a few minutes and try again.";
  }
  if (message.includes("failed to fetch") || message.includes("network")) {
    return "We could not reach the server. Check your connection and try again.";
  }

  return "Something went wrong. Please try again.";
}
