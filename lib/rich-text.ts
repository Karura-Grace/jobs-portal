/**
 * Turns whatever is stored in a job's body fields into structured HTML.
 *
 * Three shapes arrive here, and all three have to render:
 *
 *  1. HTML written by the rich-text editor. Passed through untouched.
 *  2. HTML migrated out of WordPress. Also passed through — sanitising happens
 *     separately, on render.
 *  3. **Plain text with newlines**, which is what every listing entered through
 *     the old textareas contains. Rendered as HTML those newlines collapse, so
 *     a carefully laid-out list arrived as one unbroken paragraph. That is the
 *     format loss this fixes, and it fixes it for listings already posted rather
 *     than only for new ones.
 *
 * Not server-only: the editor calls it too, to load an existing value.
 */

/** Any real tag means it is already markup. */
const HTML_TAG = /<\/?(?:p|br|ul|ol|li|div|strong|b|em|i|u|s|h[1-6]|a|blockquote|table|tr|td|th|hr)\b[^>]*>/i;

export function looksLikeHtml(value: string): boolean {
  return HTML_TAG.test(value);
}

/** `- item`, `* item`, `• item`, `– item`. */
const BULLET = /^\s*[-*•–]\s+(.*)$/;
/** `1. item`, `1) item`. */
const NUMBERED = /^\s*\d+[.)]\s+(.*)$/;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Plain text to HTML, inferring the structure the author typed.
 *
 * Lines starting with a bullet character or `1.` become list items and adjacent
 * ones are grouped into a single list — which is how people actually write these
 * fields, and the intent is unambiguous enough to honour. A blank line ends a
 * paragraph; a single newline inside one becomes a <br>, because in a job
 * listing a line break usually is a line break.
 */
export function plainTextToHtml(value: string): string {
  const lines = value.replace(/\r\n?/g, "\n").split("\n");
  const out: string[] = [];

  let listTag: "ul" | "ol" | null = null;
  let paragraph: string[] = [];

  const closeParagraph = () => {
    if (paragraph.length === 0) return;
    out.push(`<p>${paragraph.join("<br>")}</p>`);
    paragraph = [];
  };
  const closeList = () => {
    if (!listTag) return;
    out.push(`</${listTag}>`);
    listTag = null;
  };

  for (const raw of lines) {
    const line = raw.trimEnd();

    if (line.trim() === "") {
      closeParagraph();
      closeList();
      continue;
    }

    const bullet = line.match(BULLET);
    const numbered = line.match(NUMBERED);

    if (bullet || numbered) {
      closeParagraph();
      const wanted = bullet ? "ul" : "ol";
      if (listTag !== wanted) {
        closeList();
        out.push(`<${wanted}>`);
        listTag = wanted;
      }
      out.push(`<li>${escapeHtml((bullet ?? numbered)![1].trim())}</li>`);
      continue;
    }

    closeList();
    paragraph.push(escapeHtml(line.trim()));
  }

  closeParagraph();
  closeList();
  return out.join("");
}

/**
 * The one function callers should use. HTML in, HTML out; plain text in,
 * structured HTML out.
 */
export function toRichHtml(value: string | null | undefined): string {
  if (!value) return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  return looksLikeHtml(trimmed) ? trimmed : plainTextToHtml(trimmed);
}

/**
 * True when the editor's HTML carries no actual words. A contenteditable that
 * has been typed in and cleared leaves `<p><br></p>` behind, which is not empty
 * to `textContent` checks done naively but is empty to a reader — so a field
 * like this must not be stored as if the author had written something.
 */
export function isBlankHtml(html: string): boolean {
  return (
    html
      .replace(/<[^>]*>/g, "")
      .replace(/&nbsp;/gi, " ")
      .trim() === ""
  );
}
