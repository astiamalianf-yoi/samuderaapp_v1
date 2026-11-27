"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { BeachSelect } from "@/components/beach-select";
import { ObservationPicker } from "@/components/observation-picker";
import { ObservationSummary } from "@/components/observation-summary";
import { submitReport } from "@/lib/api";
import { extractLikCodes } from "@/lib/ml-code-extractor";
import type { IObservation } from "@/lib/types";

type Step = "beach" | "observe" | "summary" | "success";

export default function LaporPage() {
  const [step, setStep] = useState<Step>("beach");
  const [beach, setBeach] = useState<string | null>(null);
  const [observations, setObservations] = useState<IObservation[]>([]);
  const [submitting, setSubmitting] = useState(false);

  if (step === "success") {
    return (
      <div className="fixed inset-0 bg-[#16A34A]/90 flex flex-col items-center justify-center gap-4 z-50">
        <ShieldCheck className="w-16 h-16 text-white" />
        <h2 className="text-2xl font-bold text-white font-heading">Laporan Terkirim!</h2>
        <p className="text-white/80 font-sans">Terima kasih atas laporan Anda</p>
      </div>
    );
  }

  const handleSubmit = async () => {
    if (!beach) return;
    setSubmitting(true);
    try {
      const codes = extractLikCodes(observations);
      await submitReport(beach, codes);
      setStep("success");
      setTimeout(() => {
        setStep("beach");
        setBeach(null);
        setObservations([]);
      }, 2500);
    } catch {
      toast.error("Gagal mengirim laporan. Coba lagi.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="flex flex-col min-h-screen bg-[#FFF8F0]">
      {step === "beach" && (
        <div className="px-4 py-4 max-w-2xl mx-auto w-full">
          <Link
            href="/"
            className="flex items-center gap-2 text-[#0A2540] font-medium py-2 mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            Kembali
          </Link>
          <h1 className="font-heading text-xl font-bold text-[#0A2540] mb-4">
            Pilih Pantai
          </h1>
          <BeachSelect
            selected={beach}
            onSelect={(id) => {
              setBeach(id);
              setStep("observe");
            }}
          />
        </div>
      )}

      {step === "observe" && (
        <ObservationPicker
          observations={observations}
          onObservationsChange={setObservations}
          onComplete={() => setStep("summary")}
          onBack={() => setStep("beach")}
        />
      )}

      {step === "summary" && beach && (
        <div className="px-4 py-4 max-w-2xl mx-auto w-full">
          <ObservationSummary
            observations={observations}
            beach={beach}
            onRemove={(obs) =>
              setObservations((prev) => prev.filter((o) => o.label !== obs.label))
            }
            onBack={() => setStep("observe")}
            onSubmit={handleSubmit}
            submitting={submitting}
          />
        </div>
      )}
    </main>
  );
}
