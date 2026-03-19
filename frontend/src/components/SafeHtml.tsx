import React, { useEffect, useMemo, useRef } from "react";
import DOMPurify from "dompurify";
import hljs from "highlight.js";
import python from "highlight.js/lib/languages/python";
import "highlight.js/styles/github.css";

// Ensure we highlight Python when user uses `class="language-python"` (or `language-py`).
hljs.registerLanguage("python", python);
hljs.registerLanguage("py", python);

export function SafeHtml({ html }: { html: string }) {
  const ref = useRef<HTMLDivElement | null>(null);

  // If content is not inside `<pre><code>...</code></pre>`, treat it as plain text:
  // escape `<` and `>` so tags like `<head>...</head>` render as visible text.
  //
  // For `<pre><code>` blocks, we also escape angle brackets inside the code body
  // so users can paste raw HTML snippets without manually converting to `&lt;`/`&gt;`.
  const normalized = useMemo(() => {
    const input = String(html || "");

    const escapeAngles = (s: string) => s.replace(/</g, "&lt;").replace(/>/g, "&gt;");

    const preCodeRegex = /<pre\b[^>]*>\s*<code\b[^>]*>[\s\S]*?<\/code>\s*<\/pre>/gi;
    const openCloseRegex = /(<pre\b[^>]*>\s*<code\b[^>]*>)([\s\S]*?)(<\/code>\s*<\/pre>)/i;

    const preBlocks: string[] = [];
    const withMarkers = input.replace(preCodeRegex, (block) => {
      const m = block.match(openCloseRegex);
      if (!m) {
        preBlocks.push(block);
        return `__SAFEHTML_PRECODE_${preBlocks.length - 1}__`;
      }
      const escapedInner = escapeAngles(m[2]);
      const rebuilt = `${m[1]}${escapedInner}${m[3]}`;
      preBlocks.push(rebuilt);
      return `__SAFEHTML_PRECODE_${preBlocks.length - 1}__`;
    });

    // Escape anything outside pre/code blocks.
    const escapedOutside = escapeAngles(withMarkers);

    // Restore pre/code blocks as real HTML tags.
    return escapedOutside.replace(/__SAFEHTML_PRECODE_(\d+)__/g, (_, idxStr) => {
      const idx = Number(idxStr);
      return preBlocks[idx] ?? "";
    });
  }, [html]);

  const clean = useMemo(() => {
    return DOMPurify.sanitize(normalized, {
      USE_PROFILES: { html: true }
    });
  }, [normalized]);

  useEffect(() => {
    // highlight code blocks after render
    const root = ref.current;
    if (!root) return;
    root.querySelectorAll("pre code").forEach((el) => hljs.highlightElement(el as HTMLElement));
  }, [clean]);

  return <div ref={ref} dangerouslySetInnerHTML={{ __html: clean }} />;
}

