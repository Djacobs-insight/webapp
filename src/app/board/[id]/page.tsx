"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getResultById } from "@/lib/actions/results";
import { BackChevron } from "@/components/ui/back-chevron";

type ResultDetail = Awaited<ReturnType<typeof getResultById>>;

export default function ResultDetailPage() {
  const params = useParams<{ id: string }>();
  const [result, setResult] = useState<ResultDetail | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (params.id) {
      getResultById(params.id).then((data) => {
        setResult(data);
        setLoading(false);
      });
    }
  }, [params.id]);

  if (loading) {
    return (
      <div className="flex flex-col flex-1">
        <BackChevron href="/board" />
        <div className="flex flex-1 items-center justify-center">
          <div className="w-10 h-10 rounded-full border-4 border-coral border-t-transparent animate-spin" aria-label="Loading" />
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="flex flex-col flex-1">
        <BackChevron href="/board" />
        <main className="flex flex-col flex-1 items-center justify-center px-6 text-center">
          <span className="text-5xl mb-4">🔍</span>
          <h1 className="text-2xl font-bold text-charcoal mb-2">Result not found</h1>
          <p className="text-gray-500">This result may have been removed or you don&apos;t have access.</p>
        </main>
      </div>
    );
  }

  const mins = Math.floor(result.finishTimeSecs / 60);
  const secs = result.finishTimeSecs % 60;

  return (
    <div className="flex flex-col flex-1">
      <BackChevron href="/board" />
      <main className="flex flex-col flex-1 w-full max-w-xl mx-auto px-4 py-6 gap-6">
        {/* Header */}
        <div className="text-center">
          <p className="text-sm text-gray-400 uppercase tracking-wide font-medium">Parkrun Result</p>
          <h1 className="text-2xl font-bold text-charcoal mt-1">{result.runnerName}</h1>
        </div>

        {/* Time hero */}
        <div className="flex flex-col items-center gap-1 py-6">
          <p className="text-5xl font-bold text-teal tabular-nums">
            {mins}:{String(secs).padStart(2, "0")}
          </p>
          {result.ageGradedPct != null && (
            <p className="text-lg text-gray-500">{result.ageGradedPct.toFixed(1)}% age-graded</p>
          )}
        </div>

        {/* Details card */}
        <section className="rounded-2xl border border-gray-100 bg-white shadow-sm p-5 flex flex-col gap-4">
          <DetailRow label="Date" value={result.date} />
          <DetailRow label="Location" value={result.location} />
          <DetailRow label="Finish Time" value={`${mins}:${String(secs).padStart(2, "0")}`} />
          {result.ageGradedPct != null && (
            <DetailRow label="Age-Graded %" value={`${result.ageGradedPct.toFixed(1)}%`} />
          )}
        </section>
      </main>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-sm text-gray-400">{label}</span>
      <span className="text-sm font-medium text-charcoal">{value}</span>
    </div>
  );
}
