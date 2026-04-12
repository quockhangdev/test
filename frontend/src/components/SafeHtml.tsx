import React, { useEffect, useMemo, useRef } from "react";
import DOMPurify from "dompurify";
import type { Config } from "dompurify";
import hljs from "highlight.js";
import python from "highlight.js/lib/languages/python";
import "highlight.js/styles/github.css";
import { markdownItWithMath } from "../lib/markdownMath";

// Ensure we highlight Python when user uses `class="language-python"` (or `language-py`).
hljs.registerLanguage("python", python);
hljs.registerLanguage("py", python);

/** KaTeX có thể xuất SVG/MathML; giữ an toàn nhưng đủ cho công thức hiển thị đúng */
const sanitizeMarkdownConfig: Config = {
  USE_PROFILES: { html: true },
  ADD_TAGS: [
    "math",
    "semantics",
    "mrow",
    "mi",
    "mn",
    "mo",
    "ms",
    "mspace",
    "mtext",
    "menclose",
    "mfrac",
    "msqrt",
    "mroot",
    "mstyle",
    "msub",
    "msup",
    "msubsup",
    "munder",
    "mover",
    "munderover",
    "mpadded",
    "mphantom",
    "mtable",
    "mtr",
    "mtd",
    "mlabeledtr",
    "maligngroup",
    "malignmark",
    "annotation",
    "svg",
    "path",
    "g",
    "line",
    "rect",
    "marker",
    "defs",
    "use",
    "foreignObject",
    "clipPath",
    "mask",
    "pattern"
  ],
  ADD_ATTR: [
    "style",
    "class",
    "xmlns",
    "width",
    "height",
    "viewBox",
    "preserveAspectRatio",
    "d",
    "fill",
    "stroke",
    "stroke-width",
    "stroke-linecap",
    "stroke-linejoin",
    "x",
    "y",
    "x1",
    "y1",
    "x2",
    "y2",
    "marker-end",
    "marker-start",
    "xmlns:xlink",
    "xlink:href",
    "href",
    "focusable",
    "aria-hidden",
    "role",
    "mathvariant",
    "accent",
    "accentunder",
    "scriptlevel",
    "stretchy",
    "form",
    "fence",
    "separator",
    "symmetric",
    "largeop",
    "movablelimits",
    "displaystyle",
    "lspace",
    "rspace",
    "minsize",
    "maxsize"
  ]
};

export function SafeHtml({ html }: { html: string }) {
  const ref = useRef<HTMLDivElement | null>(null);

  const renderedHtml = useMemo(() => {
    const input = String(html || "");
    if (!input.trim()) return "";
    return markdownItWithMath.render(input);
  }, [html]);

  const clean = useMemo(() => {
    return DOMPurify.sanitize(renderedHtml, sanitizeMarkdownConfig);
  }, [renderedHtml]);

  useEffect(() => {
    // highlight code blocks after render
    const root = ref.current;
    if (!root) return;
    root.querySelectorAll("pre code").forEach((el) => hljs.highlightElement(el as HTMLElement));
  }, [clean]);

  return <div ref={ref} className="safe-html-root" dangerouslySetInnerHTML={{ __html: clean }} />;
}

