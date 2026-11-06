import type { ReactNode } from "react"

interface Props {
  children: ReactNode
}

export function MainLayout({ children }: Props) {
  return (
    <div 
      className="min-h-screen flex flex-col bg-[#F9F9F9] text-black"
      style={{
        paddingTop: 'var(--safe-area-inset-top)'
      }}
    >
      <main 
        className="flex-1 overflow-y-auto p-4"
        style={{
          paddingBottom: 'calc(1rem + var(--safe-area-inset-bottom))'
        }}
      >
        {children}
      </main>
    </div>
  )
}
