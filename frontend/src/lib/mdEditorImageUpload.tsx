import React, { useMemo } from "react";
import AddPhotoAlternateOutlinedIcon from "@mui/icons-material/AddPhotoAlternateOutlined";
import { insertTextAtPosition } from "@uiw/react-md-editor";
import type { MDEditorProps } from "@uiw/react-md-editor";
import { getExtraCommands } from "@uiw/react-md-editor/commands";
import type { ICommand } from "@uiw/react-md-editor/commands";
import { api } from "./api";

type MdTextareaProps = NonNullable<MDEditorProps["textareaProps"]>;

function isImageFile(f: File): boolean {
  return f.type.startsWith("image/");
}

export type MdEditorImageUploadConfig = {
  token: string | null | undefined;
  onError?: (message: string) => void;
};

export function useMdEditorImageUpload(config: MdEditorImageUploadConfig) {
  const { token, onError } = config;

  return useMemo(() => {
    async function uploadAndInsert(file: File, textarea: HTMLTextAreaElement) {
      if (!token) {
        onError?.("Chưa đăng nhập");
        return;
      }
      try {
        const { url } = await api.admin.uploadImage(token, file);
        insertTextAtPosition(textarea, `\n![](${url})\n`);
      } catch (e: unknown) {
        const msg = e && typeof e === "object" && "message" in e ? String((e as { message?: string }).message) : "upload_failed";
        onError?.(msg);
      }
    }

    const textareaProps: Pick<MdTextareaProps, "onPaste" | "onDragOver" | "onDrop"> = {
      onPaste: (e) => {
        const items = e.clipboardData?.items;
        if (!items) return;
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          if (item.kind !== "file") continue;
          const file = item.getAsFile();
          if (!file || !isImageFile(file)) continue;
          e.preventDefault();
          void uploadAndInsert(file, e.currentTarget);
          return;
        }
      },
      onDragOver: (e) => {
        e.preventDefault();
        e.stopPropagation();
      },
      onDrop: (e) => {
        const dt = e.dataTransfer;
        if (!dt?.files?.length) return;
        const file = Array.from(dt.files).find(isImageFile);
        if (!file) return;
        e.preventDefault();
        e.stopPropagation();
        void uploadAndInsert(file, e.currentTarget);
      }
    };

    const uploadImageCommand: ICommand = {
      name: "upload-image",
      keyCommand: "upload-image",
      buttonProps: {
        "aria-label": "Upload ảnh từ máy",
        title: "Upload ảnh từ máy"
      },
      icon: <AddPhotoAlternateOutlinedIcon sx={{ fontSize: 15 }} />,
      execute: (_state, api) => {
        if (!token) {
          onError?.("Chưa đăng nhập");
          return;
        }
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "image/*";
        input.onchange = () => {
          const file = input.files?.[0];
          if (!file || !isImageFile(file)) return;
          void uploadAndInsert(file, api.textArea);
        };
        input.click();
      }
    };

    return {
      textareaProps,
      extraCommands: [...getExtraCommands(), uploadImageCommand]
    };
  }, [token, onError]);
}
