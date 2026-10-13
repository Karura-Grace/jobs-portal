import type { MetadataRoute } from "next";
import { site } from "@/lib/content";

/**
 * There was no robots.txt at all, which the Vercel firewall log made visible:
 * Google alone accounted for 2.3k of 6.6k requests in a day on a site with two
 * live listings, and nothing told it which paths were pointless.
 *
 * Everything behind auth is disallowed. Not as a security control — these routes
 * are protected by requireUser/requireProfile and a crawler gets a redirect
 * either way — but because crawling them burns function invocations to be told
 * "sign in", and because a URL indexed today is a URL someone lands on
 * confused tomorrow.
 *
 * `/auth/*` is included for a subtler reason: a sign-up page in a search index
 * attracts credential-stuffing traffic that would otherwise never find it.
 *
 * AI crawlers are allowed, not disallowed — one of them drives real referral
 * traffic (job aggregators run their own crawler), and being indexed by the
 * AI-search ones (Perplexity, ChatGPT browsing, etc.) is wanted, not a leak.
 * The problem was never their presence, it was their request rate: Aug 2026's
 * edge-request spike that tripped the Vercel Hobby cap and paused the whole
 * site came from this traffic being uncapped. crawlDelay is a courtesy signal
 * a well-behaved crawler may honor; middleware.ts is what actually throttles
 * the ones that don't (most don't respect robots.txt at all).
 */
const AI_CRAWLER_USER_AGENTS = [
  "GPTBot",
  "ChatGPT-User",
  "CCBot",
  "Google-Extended",
  "Bytespider",
  "PerplexityBot",
  "Amazonbot",
  "Applebot-Extended",
  "ClaudeBot",
  "Claude-Web",
  "meta-externalagent",
  "Diffbot",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/dashboard", "/auth", "/api"],
      },
      {
        userAgent: AI_CRAWLER_USER_AGENTS,
        allow: "/",
        disallow: ["/admin", "/dashboard", "/auth", "/api"],
        crawlDelay: 10,
      },
    ],
    sitemap: `https://${site.domain}/sitemap.xml`,
    host: `https://${site.domain}`,
  };
}
