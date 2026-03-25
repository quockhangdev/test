/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL API (ví dụ http://127.0.0.1:5000/api) */
  readonly VITE_API_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
