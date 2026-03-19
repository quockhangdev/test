import React, { useEffect, useMemo, useRef } from "react";
import DOMPurify from "dompurify";
import hljs from "highlight.js";
import "highlight.js/styles/github.css";

export function SafeHtml({ html }: { html: string }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const clean = useMemo(() => {
    return DOMPurify.sanitize(html, {
      USE_PROFILES: { html: true }
    });
  }, [html]);

  useEffect(() => {
    // highlight code blocks after render
    const root = ref.current;
    if (!root) return;
    root.querySelectorAll("pre code").forEach((el) => hljs.highlightElement(el as HTMLElement));
  }, [clean]);

  return <div ref={ref} dangerouslySetInnerHTML={{ __html: clean }} />;
}

