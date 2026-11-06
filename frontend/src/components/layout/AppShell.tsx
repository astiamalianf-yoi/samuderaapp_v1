import type { ReactNode } from "react"
import { NavLink } from "react-router-dom"
import { BookOpen, Home, Map, Megaphone, UserRound } from "lucide-react"
import { WHATSAPP_GROUP_URL, WHATSAPP_REPORT_URL } from "../../config"

const NAV = [
  { to: "/", label: "Beranda", Icon: Home },
  { to: "/peta", label: "Peta", Icon: Map },
  { to: "/lapor", label: "Lapor", Icon: Megaphone, primary: true },
  { to: "/pengetahuan", label: "Tanda Alam", Icon: BookOpen },
  { to: "/profil", label: "Profil", Icon: UserRound },
]

interface Props {
  children: ReactNode
  title?: string
  /** Pages that fill the screen (map) skip the padding. */
  bleed?: boolean
  showWhatsApp?: boolean
}

export function AppShell({ children, title, bleed = false, showWhatsApp = true }: Props) {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-gray-950" style={{ paddingTop: "var(--safe-area-inset-top)" }}>
      <header className="sticky top-0 z-30 bg-sky-900 text-white shadow">
        <div className="max-w-xl mx-auto flex items-center gap-3 px-4 h-14">
          <img src="/192x192.png" alt="" className="w-8 h-8 rounded-lg bg-white" />
          <span className="text-xl font-black tracking-wide shrink-0">SAMUDRA</span>
          {title && <span className="text-base font-semibold opacity-90 truncate">· {title}</span>}
          {showWhatsApp && (
            <a href={WHATSAPP_REPORT_URL} target="_blank" rel="noopener noreferrer" aria-label="Lapor lewat WhatsApp"
              className="ml-auto shrink-0 flex items-center gap-1.5 h-10 pl-2 pr-3 rounded-full bg-[#25D366] text-white text-sm font-bold">
              <span className="w-6 h-6 [&>svg]:w-6 [&>svg]:h-6">{WA_ICON}</span> WA
            </a>
          )}
        </div>
      </header>

      <main className={`flex-1 w-full max-w-xl mx-auto ${bleed ? "" : "px-4 pt-4"}`}
        style={{ paddingBottom: "calc(6rem + var(--safe-area-inset-bottom))" }}>
        {children}
      </main>

      <nav className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-gray-200 shadow-[0_-2px_8px_rgba(0,0,0,0.06)]"
        style={{ paddingBottom: "var(--safe-area-inset-bottom)" }} aria-label="Menu utama">
        <ul className="max-w-xl mx-auto grid grid-cols-5">
          {NAV.map(({ to, label, Icon, primary }) => (
            <li key={to}>
              <NavLink to={to} end={to === "/"}
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center gap-0.5 h-16 text-xs font-semibold ${
                    primary ? "text-white" : isActive ? "text-sky-800" : "text-gray-500"}`}>
                {({ isActive }) => (
                  <>
                    <span className={primary
                      ? "-mt-6 w-14 h-14 rounded-full bg-orange-600 flex items-center justify-center shadow-lg ring-4 ring-white"
                      : `w-10 h-8 rounded-full flex items-center justify-center ${isActive ? "bg-sky-100" : ""}`}>
                      <Icon className={primary ? "w-7 h-7" : "w-6 h-6"} aria-hidden />
                    </span>
                    <span className={primary ? "text-orange-700" : ""}>{label}</span>
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}

const WA_ICON = (
  <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="white" aria-hidden>
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
)

/** Card linking the community WhatsApp group (used on the home page). */
export function WhatsAppGroupCard() {
  return (
    <a href={WHATSAPP_GROUP_URL} target="_blank" rel="noopener noreferrer"
      className="flex items-center gap-3 rounded-2xl bg-white border-2 border-[#25D366] p-4">
      <span className="w-12 h-12 rounded-full bg-[#25D366] flex items-center justify-center shrink-0">{WA_ICON}</span>
      <span className="flex-1">
        <span className="block text-lg font-bold">Grup WhatsApp Samudra</span>
        <span className="block text-base text-gray-700">Peringatan juga dikirim ke grup. Lapor dengan ketik <b>!lapor</b>.</span>
      </span>
    </a>
  )
}
