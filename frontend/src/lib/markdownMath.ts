import MarkdownIt from "markdown-it";
import texmath from "markdown-it-texmath";
import katex from "katex";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import type { MarkdownPreviewProps } from "@uiw/react-markdown-preview";

import "katex/dist/katex.min.css";
import "markdown-it-texmath/css/texmath.css";

const katexForTexmath = {
  throwOnError: false,
  strict: "ignore" as const
};

/** Markdown-it (dùng trong SafeHtml): `$...$`, `$$...$$`, `\\(...\\)`, `\\[...\\]` */
export const markdownItWithMath = new MarkdownIt({
  html: true,
  linkify: true,
  breaks: true
}).use(texmath, {
  engine: katex,
  delimiters: ["dollars", "brackets"],
  katexOptions: katexForTexmath
});

/** Preview @uiw/react-md-editor (remark/rehype), cùng KaTeX */
export const mdEditorMathPreviewOptions: Pick<MarkdownPreviewProps, "remarkPlugins" | "rehypePlugins"> = {
  remarkPlugins: [remarkMath],
  rehypePlugins: [[rehypeKatex, { strict: "ignore" }]]
};
