import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

/**
 * Security headers, addressing the PageSpeed "Trust and Safety" audits.
 *
 * Vercel already sent Strict-Transport-Security and nothing else. These are the
 * static headers; the Content-Security-Policy is set per-request in
 * middleware.ts because it carries a nonce.
 *
 * NOT SET, deliberately:
 *
 *   require-trusted-types-for 'script'
 *     Would break the product. components/job-detail.tsx renders job copy with
 *     dangerouslySetInnerHTML, and Trusted Types blocks exactly that unless
 *     every sink goes through a registered policy. The XSS risk it targets is
 *     already handled at the point that matters — lib/sanitize.ts runs an
 *     allowlist over that HTML on every render, verified against 11 payloads.
 *     Adding Trusted Types means routing the sanitiser output through a
 *     TrustedHTML policy first; worth doing deliberately, not as a header flip.
 *
 *   Cross-Origin-Embedder-Policy
 *     Only needed for SharedArrayBuffer / high-resolution timers, neither of
 *     which this app uses, and it breaks any cross-origin subresource that does
 *     not opt in with CORP. Cost with no benefit here.
 */
const securityHeaders = [
  {
    // Two years, now including subdomains. `preload` is deliberately omitted:
    // getting onto the preload list is easy and getting off it takes months,
    // and it would force HTTPS on every current and future *.pac.africa
    // subdomain — including the cPanel-hosted ones this project does not own.
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
  {
    // Clickjacking. CSP frame-ancestors (in middleware) is the modern control;
    // this is the fallback for older browsers that ignore it.
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    // Stops a browser second-guessing a declared Content-Type. Relevant here:
    // CV uploads are user-supplied files served back with a declared type.
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    // Origin isolation. `same-origin` is safe because auth is email/password
    // over fetch — there is no OAuth popup that would need
    // same-origin-allow-popups. Adding a social provider later means revisiting
    // this, or the popup will lose its handle to the opener.
    key: "Cross-Origin-Opener-Policy",
    value: "same-origin",
  },
  {
    // Full URL to our own origin, origin-only to others. Matters because admin
    // URLs carry applicant search terms in the query string.
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    // Nothing here needs a camera, a microphone or a location.
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
  {
    key: "X-DNS-Prefetch-Control",
    value: "on",
  },
];

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "khdvagjfonbiezkybpvh.supabase.co" },
      { protocol: "https", hostname: "jobs.pac.africa" },
    ],
  },
  poweredByHeader: false,
  experimental: {
    serverActions: {
      // A CV may be up to 5 MB (lib/cv.ts) and the apply form now posts it
      // through a server action rather than uploading from the browser, so the
      // 1 MB default would reject most real CVs with "Body exceeded 1 MB limit".
      // 6 MB leaves headroom for the rest of the multipart body. The size is
      // still checked in the action, and the storage bucket enforces 5 MB
      // independently, so this raises the ceiling without widening what is
      // accepted.
      bodySizeLimit: "6mb",
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
  widenClientFileUpload: true,
  webpack: {
    automaticVercelMonitors: true,
    treeshake: {
      removeDebugLogging: true,
    },
  },
});
