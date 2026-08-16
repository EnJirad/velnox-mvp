/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_VELSHOP_URL?: string;
  readonly VITE_VELSELLER_URL?: string;
  readonly VITE_VELCENTER_URL?: string;
  readonly VITE_CORPORATE_URL?: string;
  readonly VITE_SITE_BASENAME?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
