/**
 * Work-email-only employer signup (client-side check; the authoritative
 * backstop is the handle_new_user() trigger, migration 031 — this exists so
 * the common case never needs a round trip).
 *
 * A blocklist, not an allowlist: we cannot enumerate every real company
 * domain, but we can enumerate the handful of large free-mail providers that
 * are never a work address. Outlook/Hotmail/Live/MSN are the one exception —
 * same Microsoft consumer product family, deliberately not split hairs on.
 */
const BLOCKED_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "yahoo.co.uk",
  "ymail.com",
  "aol.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "protonmail.com",
  "proton.me",
  "gmx.com",
  "mail.com",
  "yandex.com",
]);

export function isBlockedEmployerEmail(email: string): boolean {
  const domain = email.trim().toLowerCase().split("@")[1];
  return Boolean(domain && BLOCKED_EMAIL_DOMAINS.has(domain));
}
