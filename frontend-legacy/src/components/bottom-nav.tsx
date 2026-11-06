"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, MessageSquarePlus, Map, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { label: "Beranda", href: "/", icon: Home },
  { label: "Lapor", href: "/lapor", icon: MessageSquarePlus },
  { label: "Peta", href: "/peta", icon: Map },
  { label: "Pengetahuan", href: "/pengetahuan", icon: BookOpen },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around"
      style={{
        backgroundColor: "#0A2540",
        height: "calc(64px + env(safe-area-inset-bottom))",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {tabs.map((tab) => {
        const isActive = pathname === tab.href;
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-0.5 min-h-[64px]"
            )}
          >
            <Icon
              size={24}
              className={cn(
                isActive ? "text-[#0EA5E9]" : "text-[#94A3B8]"
              )}
            />
            <span
              className={cn(
                "text-[12px] leading-tight",
                isActive ? "text-[#0EA5E9]" : "text-[#94A3B8]"
              )}
            >
              {tab.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
