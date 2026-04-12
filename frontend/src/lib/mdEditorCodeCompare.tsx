import React, { useCallback, useMemo, useRef, useState } from "react";
import CompareArrowsOutlinedIcon from "@mui/icons-material/CompareArrowsOutlined";
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography } from "@mui/material";
import { insertTextAtPosition } from "@uiw/react-md-editor";
import type { ICommand } from "@uiw/react-md-editor/commands";

function escapeHtmlAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

function escapeHtmlText(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const TABLE_STYLE = "width:100%;border-collapse:collapse;border:1px solid #ccc;table-layout:fixed;margin-bottom:1em;margin-top:1em;";
const TH_STYLE = "border:1px solid #ccc;padding:8px;background:#f5f5f5;text-align:left;";
const TD_STYLE = "border:1px solid #ccc;padding:8px;vertical-align:top;width:50%;";
const PRE_STYLE = "margin:0;white-space:pre-wrap;word-break:break-word;";

/** Chèn HTML bảng 2 cột (C++ | Python) — nội dung code đã escape. */
export function buildCodeCompareTable(cppCode: string, pythonCode: string): string {
  const c = escapeHtmlText(cppCode);
  const p = escapeHtmlText(pythonCode);
  return (
    `<table style="${escapeHtmlAttr(TABLE_STYLE)}">` +
    `<thead><tr>` +
    `<th style="${escapeHtmlAttr(TH_STYLE)}">C++</th>` +
    `<th style="${escapeHtmlAttr(TH_STYLE)}">Python</th>` +
    `</tr></thead>` +
    `<tbody><tr>` +
    `<td style="${escapeHtmlAttr(TD_STYLE)}"><pre style="${escapeHtmlAttr(PRE_STYLE)}"><code class="language-cpp">${c}</code></pre></td>` +
    `<td style="${escapeHtmlAttr(TD_STYLE)}"><pre style="${escapeHtmlAttr(PRE_STYLE)}"><code class="language-python">${p}</code></pre></td>` +
    `</tr></tbody></table>`
  );
}

export function useMdEditorCodeCompare() {
  const [open, setOpen] = useState(false);
  const [cpp, setCpp] = useState("");
  const [py, setPy] = useState("");
  const textAreaRef = useRef<HTMLTextAreaElement | null>(null);

  const handleInsert = useCallback(() => {
    const ta = textAreaRef.current;
    if (!ta) return;
    const block = `\n\n${buildCodeCompareTable(cpp, py)}\n\n`;
    insertTextAtPosition(ta, block);
    setOpen(false);
    setCpp("");
    setPy("");
    textAreaRef.current = null;
  }, [cpp, py]);

  const extraCommands: ICommand[] = useMemo(
    () => [
      {
        name: "code-compare-cpp-python",
        keyCommand: "code-compare-cpp-python",
        buttonProps: {
          "aria-label": "Chèn bảng so sánh C++ và Python",
          title: "Chèn bảng so sánh C++ / Python (2 cột)"
        },
        icon: <CompareArrowsOutlinedIcon sx={{ fontSize: 15 }} />,
        execute: (_state, api) => {
          textAreaRef.current = api.textArea;
          setOpen(true);
        }
      }
    ],
    []
  );

  const dialog = (
    <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="md">
      <DialogTitle>Mã nguồn C++ và Python</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          <Typography variant="body2" color="text.secondary">
            Dán hoặc gõ mã vào hai ô bên dưới.
          </Typography>
          <TextField
            label="C++"
            value={cpp}
            onChange={(e) => setCpp(e.target.value)}
            multiline
            minRows={10}
            fullWidth
            size="small"
            InputProps={{ sx: { fontFamily: "ui-monospace, monospace", fontSize: 13 } }}
          />
          <TextField
            label="Python"
            value={py}
            onChange={(e) => setPy(e.target.value)}
            multiline
            minRows={10}
            fullWidth
            size="small"
            InputProps={{ sx: { fontFamily: "ui-monospace, monospace", fontSize: 13 } }}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setOpen(false)}>Huỷ</Button>
        <Button variant="contained" onClick={handleInsert}>
          Chèn
        </Button>
      </DialogActions>
    </Dialog>
  );

  return { extraCommands, dialog };
}
