import { X } from "lucide-react"
import { NavItem } from "./NavItem"
import { NAV_ITEMS } from "../../constants/navigation"

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  return (
    <div
      aria-hidden={!isOpen}
      className={`fixed inset-0 z-40 pointer-events-none transition-opacity duration-300 ${
        isOpen ? "opacity-100 pointer-events-auto" : "opacity-0"
      }`}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${
          isOpen ? "opacity-100" : "opacity-0"
        }`}
      />

      {/* Sidebar Panel */}
      <aside
        role="menu"
        aria-label="Main menu"
        className={`absolute top-0 left-0 bottom-0 w-80 max-w-[85%] bg-[#F9F9F9] border-r border-slate-700 shadow-lg p-4 hw-accelerate ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{
          paddingTop: 'calc(1rem + var(--safe-area-inset-top))',
          paddingLeft: 'calc(1rem + var(--safe-area-inset-left))',
          paddingBottom: 'calc(1rem + var(--safe-area-inset-bottom))',
          transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          WebkitTransform: isOpen ? 'translateX(0) translateZ(0)' : 'translateX(-100%) translateZ(0)',
          transform: isOpen ? 'translateX(0) translateZ(0)' : 'translateX(-100%) translateZ(0)'
        }}
      >
        <div className="flex justify-between items-center mb-4">
          <span className="font-semibold text-lg">Menu</span>
          <button
            aria-label="Close menu"
            onClick={onClose}
            className="p-1 rounded-md hover:bg-white/5 focus:outline-none transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex flex-col gap-2">
          {NAV_ITEMS.map((item) => (
            <NavItem key={item.path} {...item} onClick={onClose} />
          ))}
        </nav>
      </aside>
    </div>
  )
}
