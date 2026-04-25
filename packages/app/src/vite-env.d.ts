/// <reference types="vite/client" />

interface Window {
  __tgAuthCallback?: (data: { id_token: string }) => void
}
