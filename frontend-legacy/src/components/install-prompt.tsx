"use client";

import { useEffect, useRef, useState } from "react";
import { Download, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
    appinstalled: Event;
  }
}

export function InstallPrompt() {
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem("install-prompt-dismissed") === "1") {
      setDismissed(true);
      return;
    }

    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;

    if (isStandalone) return;

    const handleBeforeInstallPrompt = (e: BeforeInstallPromptEvent) => {
      e.preventDefault();
      deferredPromptRef.current = e;
      setVisible(true);
    };

    const handleAppInstalled = () => {
      setVisible(false);
      deferredPromptRef.current = null;
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  if (dismissed || !visible) return null;

  const handleInstall = async () => {
    const prompt = deferredPromptRef.current;
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === "accepted") {
      setVisible(false);
    }
    deferredPromptRef.current = null;
  };

  const handleDismiss = () => {
    sessionStorage.setItem("install-prompt-dismissed", "1");
    setDismissed(true);
  };

  return (
    <div className="relative rounded-2xl border border-[#0A2540]/10 bg-white p-4 flex items-center gap-3">
      <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#0EA5E9]/15 flex-shrink-0">
        <Download className="w-5 h-5 text-[#0EA5E9]" />
      </div>
      <div className="flex-1 min-w-0 pr-6">
        <p className="font-semibold text-[#0A2540] font-sans">Install Aplikasi</p>
        <p className="text-sm text-[#0A2540]/60 font-sans mt-0.5">
          Website ini bisa digunakan offline. Install aplikasi untuk akses lebih cepat dan notifikasi peringatan cuaca langsung di perangkat Anda.
        </p>
      </div>
      <button
        type="button"
        onClick={handleInstall}
        className="bg-[#0EA5E9] text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-sky-600 active:scale-[0.98] transition-all flex-shrink-0"
      >
        Install Aplikasi
      </button>
      <button
        type="button"
        onClick={handleDismiss}
        className="absolute top-2 right-2 text-[#0A2540]/40 hover:text-[#0A2540] transition-colors"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
