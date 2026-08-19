/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CONVEX_URL?: string;
  readonly VITE_VELSHOP_URL?: string;
  readonly VITE_VELSELLER_URL?: string;
  readonly VITE_VELCENTER_URL?: string;
  readonly VITE_CORPORATE_URL?: string;
  readonly VITE_SITE_BASENAME?: string;
  readonly VITE_VLY_APP_ID?: string;
  readonly VITE_VLY_MONITORING_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
