/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_WAVE_PAYMENT_LINK?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}