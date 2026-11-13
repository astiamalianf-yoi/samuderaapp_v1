/** Backend base URL. Set VITE_API_BASE_URL at build time (e.g. http://localhost:3000 for local runs). */
export const API_BASE_URL: string =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") || "https://api.samudraapp.com"

export const API_HOST = (() => {
  try {
    return new URL(API_BASE_URL).host
  } catch {
    return "api.samudraapp.com"
  }
})()

/** WhatsApp: personal report bot and the community group. */
export const WHATSAPP_REPORT_URL =
  (import.meta.env.VITE_WHATSAPP_REPORT_URL as string | undefined) || "https://wa.me/6287816964069"
export const WHATSAPP_GROUP_URL =
  (import.meta.env.VITE_WHATSAPP_GROUP_URL as string | undefined) || "https://chat.whatsapp.com/Fxg7ztLOfbJBcikGh4uPKD"
