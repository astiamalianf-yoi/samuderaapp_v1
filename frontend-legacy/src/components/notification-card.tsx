"use client";

import { Bell, BellRing, BellOff, Loader2 } from "lucide-react";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import { cn } from "@/lib/utils";

type NotificationCardProps = {
  selectedBeach?: string | null;
};

function Toggle({ on, disabled, onClick }: { on: boolean; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "relative inline-flex h-7 w-12 items-center rounded-full transition-colors flex-shrink-0",
        on ? "bg-[#0EA5E9]" : "bg-[#0A2540]/20",
        disabled && "opacity-50"
      )}
    >
      <span
        className={cn(
          "inline-block h-5 w-5 rounded-full bg-white shadow transition-transform",
          on ? "translate-x-6" : "translate-x-1"
        )}
      />
    </button>
  );
}

export function NotificationCard({ selectedBeach }: NotificationCardProps) {
  const { permission, isSupported, isSubscribed, isLoading, error, subscribe, unsubscribe, mounted } =
    usePushNotifications(selectedBeach);

  if (!mounted || !isSupported) {
    if (!mounted) {
      return (
        <div className="rounded-2xl border border-[#0A2540]/10 bg-white p-4 flex items-center gap-3 animate-pulse">
          <div className="w-10 h-10 rounded-xl bg-[#0A2540]/10" />
          <div className="flex-1">
            <div className="h-4 bg-[#0A2540]/10 rounded w-32 mb-2" />
            <div className="h-3 bg-[#0A2540]/10 rounded w-24" />
          </div>
        </div>
      );
    }
    return null;
  }

  const handleToggle = () => {
    if (isSubscribed) {
      unsubscribe();
    } else {
      subscribe();
    }
  };

  if (permission === "denied") {
    return (
      <div className="rounded-2xl border border-[#EF4444]/20 bg-[#EF4444]/5 p-4 flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#EF4444]/10 flex-shrink-0">
          <BellOff className="w-5 h-5 text-[#EF4444]" />
        </div>
        <div className="flex-1">
          <p className="font-semibold text-[#0A2540] font-sans">Notifikasi Diblokir</p>
          <p className="text-sm text-[#0A2540]/60 font-sans mt-0.5">
            Buka pengaturan browser untuk mengaktifkan
          </p>
        </div>
      </div>
    );
  }

  const Icon = isSubscribed ? BellRing : Bell;
  const accentColor = isSubscribed ? "#0EA5E9" : "#F59E0B";

  return (
    <div
      className={cn(
        "rounded-2xl border p-4 flex items-center gap-3",
        isSubscribed
          ? "border-[#0EA5E9]/20 bg-[#0EA5E9]/5"
          : "border-[#0A2540]/10 bg-white"
      )}
    >
      <div
        className="flex items-center justify-center w-10 h-10 rounded-xl flex-shrink-0"
        style={{ backgroundColor: `${accentColor}15` }}
      >
        <Icon className="w-5 h-5" style={{ color: accentColor }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-[#0A2540] font-sans">
          {error ?? (isSubscribed ? "Notifikasi Aktif" : "Notifikasi Cuaca")}
        </p>
        <p className="text-sm text-[#0A2540]/60 font-sans mt-0.5 truncate">
          {isSubscribed
            ? selectedBeach
              ? `Pantai ${selectedBeach.replace("pantai_", "").replace("_", " ")}`
              : "Pantai terdekat"
            : "Dapatkan peringatan langsung"}
        </p>
      </div>
      {isLoading ? (
        <Loader2 className="w-5 h-5 animate-spin text-[#0EA5E9] flex-shrink-0" />
      ) : (
        <Toggle on={isSubscribed} disabled={false} onClick={handleToggle} />
      )}
    </div>
  );
}
