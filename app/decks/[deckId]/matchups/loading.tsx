import { Loader2, Swords } from "lucide-react";

export default function MatchupsLoading() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 p-6">
      <div className="flex items-center gap-2 text-gray-200">
        <Swords className="h-5 w-5" aria-hidden="true" />
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
        <span className="text-sm">Loading matchups…</span>
      </div>
    </div>
  );
}
