/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BACKEND_URL: string;
  readonly VITE_GEMINI_API_KEY: string;
  // add other env variables as needed...
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
