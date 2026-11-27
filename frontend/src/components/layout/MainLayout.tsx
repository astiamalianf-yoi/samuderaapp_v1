import type { ReactNode } from "react"
import { AppShell } from "./AppShell"

interface Props {
  children: ReactNode
}

/** Kept for older pages; everything now shares the AppShell (header + bottom menu). */
export function MainLayout({ children }: Props) {
  return <AppShell>{children}</AppShell>
}
