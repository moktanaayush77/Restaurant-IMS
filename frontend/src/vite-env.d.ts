/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Backend API base, e.g. https://restaurant-ims-backend.onrender.com/api.
   *  Unset in local dev — Vite proxies /api to the backend. */
  readonly VITE_API_URL?: string
  /** Backend WebSocket origin, e.g. wss://restaurant-ims-backend.onrender.com.
   *  Unset in local dev — falls back to the current host. */
  readonly VITE_WS_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
