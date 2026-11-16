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
/** The SAMUDRA bot number (digits, e.g. 6281234567890), set as WHATSAPP_BOT_NUMBER in the stack's .env. */
const WHATSAPP_BOT_NUMBER = ((import.meta.env.VITE_WHATSAPP_BOT_NUMBER as string | undefined) || "").replace(/\D/g, "")
/** Private chat with the bot, with "!lapor " already typed, so a fisherman reports privately. */
export const WHATSAPP_REPORT_URL = WHATSAPP_BOT_NUMBER
  ? `https://wa.me/${WHATSAPP_BOT_NUMBER}?text=${encodeURIComponent("!lapor ")}`
  : (import.meta.env.VITE_WHATSAPP_REPORT_URL as string | undefined) || "https://wa.me/6287816964069"
