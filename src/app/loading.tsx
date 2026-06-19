import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[50vh] w-full">
      <div className="p-4 bg-white/80 backdrop-blur-md border border-white shadow-xl rounded-2xl flex items-center justify-center animate-in zoom-in-95 duration-300">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
      <p className="mt-4 font-semibold text-slate-500 tracking-wide text-sm animate-pulse">Memuat data...</p>
    </div>
  );
}
