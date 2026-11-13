"use client";

import { X, ArrowLeft, Send, Loader2 } from "lucide-react";
import type { IObservation } from "@/lib/types";
import { OBSERVATION_DATA, ATTRIBUTE_LABELS } from "@/lib/observation-data";

type ObservationSummaryProps = {
  observations: IObservation[];
  beach: string;
  onRemove: (obs: IObservation) => void;
  onBack: () => void;
  onSubmit: () => void;
  submitting: boolean;
};

function getCategoryForObservation(obs: IObservation): string {
  for (const [catId, groups] of Object.entries(OBSERVATION_DATA)) {
    for (const observations of Object.values(groups)) {
      if (observations.some((o) => o.label === obs.label)) {
        return catId;
      }
    }
  }
  return "lainnya";
}

const CATEGORY_LABELS: Record<string, string> = {
  laut: "Kondisi Laut",
  cuaca: "Cuaca & Angin",
  langit: "Bintang & Langit",
  hewan: "Tanda Hewan",
};

const CATEGORY_ICONS: Record<string, string> = {
  laut: "🌊",
  cuaca: "☁️",
  langit: "🌌",
  hewan: "🐋",
};

export function ObservationSummary({
  observations,
  beach,
  onRemove,
  onBack,
  onSubmit,
  submitting,
}: ObservationSummaryProps) {
  const grouped: Record<string, IObservation[]> = {};
  for (const obs of observations) {
    const cat = getCategoryForObservation(obs);
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(obs);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#0A2540]/10 text-[#0A2540]"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h2 className="text-lg font-semibold text-[#0A2540]">Ringkasan Laporan</h2>
          <p className="text-sm text-[#0A2540]/60">Pantai {beach.replace("pantai_", "").replace("_", " ")}</p>
        </div>
      </div>

      {observations.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <p className="text-[#0A2540]/50 text-base">Pilih tanda alam terlebih dahulu</p>
          <button
            type="button"
            onClick={onBack}
            className="px-6 py-3 rounded-2xl bg-[#0A2540]/10 text-[#0A2540] font-semibold text-base"
          >
            Pilih Tanda
          </button>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-4">
            {Object.entries(grouped).map(([cat, obs]) => (
              <div key={cat} className="flex flex-col gap-2">
                <p className="text-sm font-medium text-[#0A2540]/50 flex items-center gap-2">
                  <span>{CATEGORY_ICONS[cat] || "📌"}</span>
                  {CATEGORY_LABELS[cat] || cat}
                </p>
                <div className="flex flex-col gap-2">
                  {obs.map((o) => (
                    <div
                      key={o.label}
                      className="flex items-center justify-between rounded-2xl bg-white border border-[#0A2540]/10 px-4 py-3 min-h-[56px]"
                    >
                      <span className="text-base text-[#0A2540]">{o.label}</span>
                      <button
                        type="button"
                        onClick={() => onRemove(o)}
                        className="flex items-center justify-center w-8 h-8 rounded-xl text-[#EF4444] hover:bg-[#EF4444]/10"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="sticky bottom-4 mt-4">
            <button
              type="button"
              onClick={onSubmit}
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 rounded-2xl bg-[#0EA5E9] text-white font-semibold text-lg py-4 min-h-[60px] disabled:opacity-50 active:scale-[0.98] transition-transform"
            >
              {submitting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
              {submitting ? "Mengirim..." : "KIRIM LAPORAN"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
