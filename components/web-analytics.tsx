"use client";

import { Analytics } from "@vercel/analytics/next";

/**
 * Vercel Web Analytics, with a redaction filter.
 *
 * WHY THIS IS NOT JUST `<Analytics />` IN THE LAYOUT
 * Analytics reports the URL of each page view, and on this site URLs carry
 * personal data:
 *
 *   /admin/applications?q=john+doe     an applicant's name, typed by staff
 *   /admin/jobs/<uuid>/edit            internal ids
 *   /dashboard/seeker/...              a signed-in person's own pages
 *
 * Sending those to a third-party analytics service would leak applicant names
 * out of the product, which is the opposite of what the private bucket and the
 * RLS work are for. So:
 *
 *   - admin and dashboard page views are dropped entirely. They are staff
 *     screens; there is nothing to learn from measuring them that justifies
 *     transmitting them.
 *   - every other URL has its query string stripped before sending. That costs
 *     us knowing which search terms are popular on /jobs, which is a fair price
 *     for never having to reason about what a visitor typed into a box.
 *
 * `beforeSend` takes a function, and functions cannot be passed from a server
 * component — hence this thin client wrapper rather than using <Analytics />
 * directly in app/layout.tsx.
 */
export function WebAnalytics() {
  return (
    <Analytics
      beforeSend={(event) => {
        let url: URL;
        try {
          url = new URL(event.url);
        } catch {
          // Unparseable: drop it rather than forward something unknown.
          return null;
        }

        if (
          url.pathname.startsWith("/admin") ||
          url.pathname.startsWith("/dashboard")
        ) {
          return null;
        }

        url.search = "";
        url.hash = "";
        return { ...event, url: url.toString() };
      }}
    />
  );
}
