/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_SERVER_URL: string;
    readonly VITE_APP_SITE_URL?: string;
    readonly VITE_MARKETING_SITE_URL?: string;
    readonly VITE_DOCS_SITE_URL?: string;
    readonly VITE_TERMS_URL?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
