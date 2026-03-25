import React, { useEffect, useMemo, useRef } from "react";
import DOMPurify from "dompurify";
import hljs from "highlight.js";
import python from "highlight.js/lib/languages/python";
import MarkdownIt from "markdown-it";
import "highlight.js/styles/github.css";

// Ensure we highlight Python when user uses `class="language-python"` (or `language-py`).
hljs.registerLanguage("python", python);
hljs.registerLanguage("py", python);

const md = new MarkdownIt({
  html: false, // keep markdown safe; raw html in markdown is escaped
  linkify: true,
  breaks: true
});

export function SafeHtml({ html }: { html: string }) {
  const ref = useRef<HTMLDivElement | null>(null);

  const renderedHtml = useMemo(() => {
    const input = String(html || "");
    if (!input.trim()) return "";
    return md.render(input);
  }, [html]);

  const clean = useMemo(() => {
    return DOMPurify.sanitize(renderedHtml, {
      USE_PROFILES: { html: true }
    });
  }, [renderedHtml]);

  useEffect(() => {
    // highlight code blocks after render
    const root = ref.current;
    if (!root) return;
    root.querySelectorAll("pre code").forEach((el) => hljs.highlightElement(el as HTMLElement));
  }, [clean]);

  return <div ref={ref} dangerouslySetInnerHTML={{ __html: clean }} />;
}

