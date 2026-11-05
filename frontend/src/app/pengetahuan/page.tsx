import { TRUSTED_SIGNS } from "@/lib/trusted-signs";
import { SignCard } from "@/components/sign-card";

export default function PengetahuanPage() {
  return (
    <main className="flex flex-col gap-6 px-4 py-6 max-w-2xl mx-auto pb-24">
      <div>
        <h1 className="text-xl font-bold font-[family-name:var(--font-heading)] text-[#0A2540]">
          Pengetahuan Nelayan
        </h1>
        <p className="text-sm text-[#475569]">
          Tanda-tanda alam yang dipercaya nelayan
        </p>
      </div>
      <div className="flex flex-col gap-4">
        {TRUSTED_SIGNS.map((sign) => (
          <SignCard key={sign.code} sign={sign} />
        ))}
      </div>
    </main>
  );
}
