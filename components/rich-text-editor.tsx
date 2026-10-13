"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  Bold,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  RemoveFormatting,
  Underline,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { isBlankHtml, toRichHtml } from "@/lib/rich-text";

/**
 * Rich text for the job body fields.
 *
 * WHY IT IS BUILT RATHER THAN INSTALLED. The brief rules out new libraries, and
 * this needs six controls over about ten tags — TipTap and friends bring a
 * document model, a schema and 100kb+ to do that. So: a contenteditable div, a
 * hidden input carrying its HTML, and `document.execCommand` for the commands.
 *
 * execCommand IS deprecated, and that is a real caveat rather than one to hide.
 * It is also implemented by every current browser, has no standardised
 * replacement, and its output here is passed through the same allowlist
 * sanitiser as anything else (lib/sanitize.ts), so the messy markup it can emit
 * is normalised before it is stored or shown. If it is ever removed, this
 * component is the only thing that has to change.
 *
 * WHAT MAKES IT HONEST. The editing surface carries `.prose-job` — the same
 * class the rendered listing uses. One stylesheet lays out both, so bullets,
 * spacing and emphasis look identical in the form and on the page. That was the
 * actual complaint: the old textarea could not show structure, and the listing
 * did not render it either.
 *
 * PASTE IS FLATTENED TO TEXT, deliberately. Copy from Word or a PDF and the
 * clipboard carries `<span style="mso-...">` wrappers and font tags; the
 * sanitiser strips them, but not before they have polluted the document the
 * author is looking at. Pasting plain text and letting the newline inference in
 * lib/rich-text.ts rebuild the lists gives a predictable result.
 */

type Command = {
  key: string;
  label: string;
  icon: typeof Bold;
  /** execCommand name, for the ones that map straight through. */
  command?: string;
  /** queryCommandState name, when the button should light up. */
  state?: string;
  onRun?: () => void;
};

export function RichTextEditor({
  name,
  defaultValue,
  placeholder,
  labelledBy,
  required = false,
  /** Seed an empty editor with a bullet list, so typing starts as a bullet. */
  startAsList = false,
  minHeight,
}: {
  name: string;
  defaultValue?: string | null;
  placeholder?: string;
  labelledBy?: string;
  required?: boolean;
  startAsList?: boolean;
  minHeight?: number;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [active, setActive] = useState<Record<string, boolean>>({});
  const [empty, setEmpty] = useState(true);
  const toolbarId = useId();

  /** Copy the editor's HTML into the hidden input the form actually submits. */
  const sync = useCallback(() => {
    const editor = editorRef.current;
    const input = inputRef.current;
    if (!editor || !input) return;
    const html = editor.innerHTML;
    const blank = isBlankHtml(html);
    setEmpty(blank);
    // A field cleared back to `<p><br></p>` must submit as empty, not as markup
    // that renders a stray blank line on the listing.
    input.value = blank ? "" : html;
  }, []);

  const refreshActive = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    // Only report state while the caret is actually inside this editor —
    // queryCommandState is document-wide, so two editors on one page would
    // otherwise light each other's buttons up.
    const selection = window.getSelection();
    if (!selection?.anchorNode || !editor.contains(selection.anchorNode)) return;
    setActive({
      bold: document.queryCommandState("bold"),
      italic: document.queryCommandState("italic"),
      underline: document.queryCommandState("underline"),
      insertUnorderedList: document.queryCommandState("insertUnorderedList"),
      insertOrderedList: document.queryCommandState("insertOrderedList"),
    });
  }, []);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    // Enter should produce <p>, not the <div> some browsers default to — <p> is
    // what the sanitiser allows and what .prose-job gives rhythm to.
    try {
      document.execCommand("defaultParagraphSeparator", false, "p");
    } catch {
      // Not supported anywhere it matters; the fallback is <div>, which the
      // sanitiser drops to inline content rather than breaking.
    }

    const initial = toRichHtml(defaultValue);
    if (initial) {
      editor.innerHTML = initial;
    } else if (startAsList) {
      // Responsibilities and qualifications are lists in practice, so start as
      // one instead of asking the author to press a button first.
      editor.innerHTML = "<ul><li></li></ul>";
    }
    sync();

    const onSelectionChange = () => refreshActive();
    document.addEventListener("selectionchange", onSelectionChange);
    return () => document.removeEventListener("selectionchange", onSelectionChange);
    // Mount only: this seeds the editor, and re-running it would overwrite
    // whatever the author has typed since.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const run = (command: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    sync();
    refreshActive();
  };

  const addLink = () => {
    const selection = window.getSelection();
    const selected = selection?.toString() ?? "";
    const url = window.prompt(
      selected
        ? `Link "${selected.slice(0, 40)}" to which address?`
        : "Paste the address to link to:",
      "https://"
    );
    if (!url || url === "https://") return;
    // Only http(s) and mailto reach the document. The sanitiser blocks
    // javascript: on render too, but a form that lets you type one and appears
    // to accept it is its own problem.
    if (!/^(https?:\/\/|mailto:)/i.test(url)) {
      window.alert("Links must start with https:// or mailto:");
      return;
    }
    if (selected) run("createLink", url);
    else {
      run("insertHTML", `<a href="${url.replace(/"/g, "&quot;")}">${url}</a>`);
    }
  };

  const commands: Command[] = [
    { key: "bold", label: "Bold", icon: Bold, command: "bold", state: "bold" },
    { key: "italic", label: "Italic", icon: Italic, command: "italic", state: "italic" },
    {
      key: "underline",
      label: "Underline",
      icon: Underline,
      command: "underline",
      state: "underline",
    },
    {
      key: "insertUnorderedList",
      label: "Bullet list",
      icon: List,
      command: "insertUnorderedList",
      state: "insertUnorderedList",
    },
    {
      key: "insertOrderedList",
      label: "Numbered list",
      icon: ListOrdered,
      command: "insertOrderedList",
      state: "insertOrderedList",
    },
    { key: "link", label: "Add a link", icon: LinkIcon, onRun: addLink },
    {
      key: "removeFormat",
      label: "Clear formatting",
      icon: RemoveFormatting,
      command: "removeFormat",
    },
  ];

  return (
    <div>
      {/* What the form posts. The contenteditable itself cannot be a form
          control, so this is the field — and it means the whole thing degrades
          to "no editor, no value" rather than to a broken submit. */}
      <input ref={inputRef} type="hidden" name={name} required={required} />

      <div
        role="toolbar"
        aria-label="Formatting"
        aria-controls={toolbarId}
        className="flex flex-wrap items-center gap-0.5 rounded-t-card border-b border-line bg-surface-raised px-1.5 py-1.5"
      >
        {commands.map((cmd) => {
          const Icon = cmd.icon;
          const isActive = cmd.state ? Boolean(active[cmd.state]) : false;
          return (
            <button
              key={cmd.key}
              type="button"
              // Keeps the caret where it was: mousedown default would move focus
              // off the editor before the command runs, and execCommand needs a
              // live selection.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => (cmd.onRun ? cmd.onRun() : run(cmd.command!))}
              aria-pressed={cmd.state ? isActive : undefined}
              title={cmd.label}
              className={cn(
                "press grid h-7 w-7 place-items-center rounded-[7px] transition-colors duration-150",
                isActive
                  ? "bg-accent/15 text-accent-text"
                  : "text-muted hover:bg-surface hover:text-ink"
              )}
            >
              <Icon className="h-[15px] w-[15px]" aria-hidden />
              <span className="sr-only">{cmd.label}</span>
            </button>
          );
        })}
      </div>

      <div
        id={toolbarId}
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-labelledby={labelledBy}
        data-empty={empty}
        data-placeholder={placeholder}
        style={minHeight ? { minHeight } : undefined}
        className="prose-job prose-editor"
        onInput={sync}
        onBlur={sync}
        onKeyUp={refreshActive}
        onMouseUp={refreshActive}
        onPaste={(event) => {
          // Flattened to text on purpose — see the note at the top.
          event.preventDefault();
          const text = event.clipboardData.getData("text/plain");
          if (!text) return;
          document.execCommand("insertText", false, text);
          sync();
        }}
      />
    </div>
  );
}
