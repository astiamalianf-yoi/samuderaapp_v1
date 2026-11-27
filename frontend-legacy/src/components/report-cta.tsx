import Link from "next/link";
import { Megaphone } from "lucide-react";

export function ReportCTA() {
  return (
    <Link
      href="/lapor"
      className="block w-full bg-[#F59E0B] hover:bg-amber-600 text-white font-bold text-lg rounded-2xl h-14 shadow-md active:scale-[0.98] transition-transform flex items-center justify-center gap-3"
    >
      <Megaphone size={20} />
      LAPOR CUACA SEKARANG
    </Link>
  );
}
