"use client";

import { useState } from "react";
import { ArrowLeft, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { IObservation } from "@/lib/types";
import { OBSERVATION_DATA, CATEGORY_LIST, ATTRIBUTE_LABELS } from "@/lib/observation-data";

type Step = "category" | "attribute" | "condition";

type ObservationPickerProps = {
  observations: IObservation[];
  onObservationsChange: (obs: IObservation[]) => void;
  onComplete: () => void;
  onBack: () => void;
};

export function ObservationPicker({
  observations,
  onObservationsChange,
  onComplete,
  onBack,
}: ObservationPickerProps) {
  const [step, setStep] = useState<Step>("category");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedAttribute, setSelectedAttribute] = useState<string | null>(null);

  const isObsSelected = (obs: IObservation) =>
    observations.some((o) => o.label === obs.label);

  const toggleObservation = (obs: IObservation) => {
    if (isObsSelected(obs)) {
      onObservationsChange(observations.filter((o) => o.label !== obs.label));
    } else {
      onObservationsChange([...observations, obs]);
    }
  };

  const countForAttribute = (catId: string, attrKey: string) => {
    const group = OBSERVATION_DATA[catId]?.[attrKey] ?? [];
    return group.filter((o) => isObsSelected(o)).length;
  };

  const handleCategorySelect = (catId: string) => {
    setSelectedCategory(catId);
    setSelectedAttribute(null);
    setStep("attribute");
  };

  const handleAttributeSelect = (attrKey: string) => {
    setSelectedAttribute(attrKey);
    setStep("condition");
  };

  const handleBack = () => {
    if (step === "attribute") {
      setSelectedCategory(null);
      setStep("category");
    } else if (step === "condition") {
      setSelectedAttribute(null);
      setStep("attribute");
    }
  };

  const categoryInfo = CATEGORY_LIST.find((c) => c.id === selectedCategory);
  const attrLabel =
    selectedAttribute && selectedCategory
      ? ATTRIBUTE_LABELS[selectedAttribute] ?? selectedAttribute
      : "";

  return (
    <div className="relative min-h-screen bg-[#FFF8F0] px-4 pb-32 pt-4">
      {step === "category" && (
        <div>
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-[#0A2540] font-medium py-2 mb-4 font-sans"
          >
            <ArrowLeft className="w-5 h-5" />
            Kembali
          </button>
          <h2 className="font-heading text-xl font-bold text-[#0A2540] mb-4">
            Pilih Kategori Pengamatan
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {CATEGORY_LIST.map((cat) => {
              const catCount = Object.keys(OBSERVATION_DATA[cat.id] ?? {}).reduce(
                (sum, attrKey) => sum + countForAttribute(cat.id, attrKey),
                0
              );
              return (
                <button
                  key={cat.id}
                  onClick={() => handleCategorySelect(cat.id)}
                  className={cn(
                    "flex flex-col items-center justify-center min-h-[80px] p-4 rounded-2xl border-2 transition-all",
                    "bg-white border-[#0A2540]/10 active:scale-[0.97]"
                  )}
                >
                  <span className="text-3xl mb-2">{cat.icon}</span>
                  <span className="font-semibold text-[#0A2540] font-sans text-sm text-center leading-tight">
                    {cat.label}
                  </span>
                  {catCount > 0 && (
                    <span className="mt-1 text-xs font-bold text-[#0EA5E9]">
                      {catCount} dipilih
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {step === "attribute" && selectedCategory && (
        <div>
          <button
            onClick={handleBack}
            className="flex items-center gap-2 text-[#0A2540] font-medium py-2 mb-4 font-sans"
          >
            <ArrowLeft className="w-5 h-5" />
            Kembali
          </button>
          <div className="flex items-center gap-3 mb-4">
            <span className="text-3xl">{categoryInfo?.icon}</span>
            <h2 className="font-heading text-xl font-bold text-[#0A2540]">
              {categoryInfo?.label}
            </h2>
          </div>
          <div className="flex flex-col gap-2">
            {Object.keys(OBSERVATION_DATA[selectedCategory] ?? {}).map((attrKey) => {
              const count = countForAttribute(selectedCategory, attrKey);
              const label = ATTRIBUTE_LABELS[attrKey] ?? attrKey;
              return (
                <button
                  key={attrKey}
                  onClick={() => handleAttributeSelect(attrKey)}
                  className="flex items-center justify-between p-4 rounded-2xl bg-white border border-[#0A2540]/10 active:scale-[0.98] transition-transform"
                >
                  <span className="font-medium text-[#0A2540] font-sans">{label}</span>
                  {count > 0 && (
                    <span className="w-6 h-6 rounded-full bg-[#0EA5E9] text-white text-xs font-bold flex items-center justify-center">
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {step === "condition" && selectedCategory && selectedAttribute && (
        <div>
          <button
            onClick={handleBack}
            className="flex items-center gap-2 text-[#0A2540] font-medium py-2 mb-4 font-sans"
          >
            <ArrowLeft className="w-5 h-5" />
            Kembali
          </button>
          <h2 className="font-heading text-xl font-bold text-[#0A2540] mb-4">
            {attrLabel}
          </h2>
          <div className="flex flex-col gap-2">
            {(OBSERVATION_DATA[selectedCategory]?.[selectedAttribute] ?? []).map(
              (obs) => {
                const selected = isObsSelected(obs);
                return (
                  <button
                    key={obs.label}
                    onClick={() => toggleObservation(obs)}
                    className={cn(
                      "flex items-center justify-between p-4 rounded-2xl transition-all",
                      selected
                        ? "bg-[#0EA5E9]/10 border border-[#0EA5E9]"
                        : "bg-white border border-[#0A2540]/10"
                    )}
                  >
                    <span
                      className={cn(
                        "font-sans text-left",
                        selected
                          ? "text-[#0A2540] font-semibold"
                          : "text-[#0A2540] font-medium"
                      )}
                    >
                      {obs.label}
                    </span>
                    {selected && (
                      <Check className="w-5 h-5 text-[#0EA5E9] flex-shrink-0 ml-3" />
                    )}
                  </button>
                );
              }
            )}
          </div>
          <button
            onClick={onComplete}
            className="w-full py-4 rounded-2xl bg-[#0EA5E9] text-white font-semibold text-lg font-sans mt-6 active:scale-[0.98] transition-transform"
          >
            Selesai Memilih
          </button>
        </div>
      )}

      {observations.length > 0 && step !== "category" && (
        <div className="fixed bottom-24 right-4 z-50">
          <div className="w-12 h-12 bg-[#0EA5E9] text-white rounded-full flex items-center justify-center text-lg font-bold shadow-lg">
            {observations.length}
          </div>
        </div>
      )}
    </div>
  );
}
