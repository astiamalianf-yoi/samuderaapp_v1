import { Home } from "lucide-react"
import type { LucideIcon } from "lucide-react"

export interface NavItem {
  path: string
  label: string
  icon: LucideIcon
}

export const NAV_ITEMS: NavItem[] = [
  { path: "/", label: "Beranda", icon: Home },
] as const
