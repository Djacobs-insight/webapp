"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth/useAuth";
import { submitResult } from "@/lib/actions/results";
import { getUserHomeEvent } from "@/lib/actions/profile";
import { useToast } from "@/components/ui/toast-provider";
import { useOptimisticResult } from "@/lib/optimistic-result-context";
import { BackChevron } from "@/components/ui/back-chevron";
import { Button } from "@/components/ui/button";

export default function AddResultPage() {
  const { account, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useToast();

  const { setOptimisticResult, setPendingSubmission, clearOptimistic, setCelebrationMilestones } = useOptimisticResult();

  const [date, setDate] = useState(() => searchParams.get("date") || new Date().toISOString().split("T")[0]);
  const [location, setLocation] = useState(() => searchParams.get("location") || "");
  const [finishTime, setFinishTime] = useState(() => searchParams.get("time") || "");
  const [timeError, setTimeError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (account && !searchParams.get("location")) {
      getUserHomeEvent().then((home) => {
        if (home) setLocation((prev) => prev || home);
      });
    }
  }, [account, searchParams]);

  if (authLoading) {
    return (
      <div className="flex flex-1 items-center justify-center min-h-screen">
        <div className="w-10 h-10 rounded-full border-4 border-coral border-t-transparent animate-spin" aria-label="Loading" />
      </div>
    );
  }

  if (!account) {
    return (
      <div className="flex flex-col flex-1">
        <BackChevron />
        <main className="flex flex-col flex-1 w-full max-w-xl mx-auto px-4 py-6 gap-6">
          <h1 className="text-2xl font-bold text-charcoal">Add Result</h1>
          <p className="text-gray-500">Sign in to record your parkrun results.</p>
          <Button variant="primary" onClick={() => router.push("/auth/signin")} className="w-full">
            Sign in
          </Button>
        </main>
      </div>
    );
  }

  const timeRegex = /^\d{1,3}:\d{2}$/;

  function validateTime(value: string) {
    if (!value) {
      setTimeError("");
      return;
    }
    if (!timeRegex.test(value)) {
      setTimeError("Use mm:ss format (e.g. 25:30)");
      return;
    }
    const [mins, secs] = value.split(":").map(Number);
    if (secs >= 60) {
      setTimeError("Seconds must be less than 60");
      return;
    }
    if (mins + secs === 0) {
      setTimeError("Time must be greater than 0");
      return;
    }
    setTimeError("");
  }

  const isValid =
    date &&
    location.trim().length > 0 &&
    timeRegex.test(finishTime) &&
    !timeError;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!isValid || submitting) return;

    setSubmitting(true);

    // Parse finish time for optimistic display
    const [mins, secs] = finishTime.split(":").map(Number);
    const finishTimeSecs = mins * 60 + secs;
    const d = new Date(date);
    const dd = String(d.getUTCDate()).padStart(2, "0");
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    const yyyy = d.getUTCFullYear();

    // Set optimistic result and navigate immediately
    setOptimisticResult({
      id: `optimistic-${Date.now()}`,
      date: `${dd}/${mm}/${yyyy}`,
      location: location.trim(),
      finishTimeSecs,
      ageGradedPct: null,
      pending: true,
    });
    setPendingSubmission({ date, location: location.trim(), finishTime });
    router.push("/");

    // Fire server action in background
    const result = await submitResult({ date, location: location.trim(), finishTime });
    setSubmitting(false);

    if (result.success) {
      // Mark optimistic as confirmed — dashboard will refresh real data
      setOptimisticResult((prev) => prev ? { ...prev, pending: false, ageGradedPct: result.ageGradedPct } : null);
      const msg = result.ageGradedPct
        ? `Result saved! Age-graded: ${result.ageGradedPct.toFixed(1)}%`
        : "Result saved!";
      showToast("success", msg);
      if (result.milestones.length > 0) {
        setCelebrationMilestones(result.milestones);
      }
    } else {
      // Rollback: clear optimistic, show error, navigate back to form with data
      clearOptimistic();
      showToast("error", result.error);
      router.push(`/results/new?date=${encodeURIComponent(date)}&location=${encodeURIComponent(location.trim())}&time=${encodeURIComponent(finishTime)}`);
    }
  }

  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="flex flex-col flex-1">
      <BackChevron />
      <main className="flex flex-col flex-1 w-full max-w-xl mx-auto px-4 py-6 gap-6">
        <h1 className="text-2xl font-bold text-charcoal">Add Result</h1>
        <p className="text-gray-500 text-sm -mt-4">
          Record your parkrun finish time
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* Date */}
          <div className="relative">
            <input
              type="date"
              id="result-date"
              value={date}
              max={today}
              onChange={(e) => setDate(e.target.value)}
              required
              className="peer w-full h-12 px-4 pt-4 pb-1 text-base rounded-xl border-2 border-gray-200 bg-white text-charcoal focus:outline-none focus:border-teal focus:ring-2 focus:ring-teal/20"
            />
            <label
              htmlFor="result-date"
              className="absolute left-4 top-1 text-xs text-gray-400 peer-focus:text-teal transition-all"
            >
              Date
            </label>
          </div>

          {/* Location */}
          <div className="relative">
            <input
              type="text"
              id="result-location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder=" "
              maxLength={200}
              required
              className="peer w-full h-12 px-4 pt-4 pb-1 text-base rounded-xl border-2 border-gray-200 bg-white text-charcoal focus:outline-none focus:border-teal focus:ring-2 focus:ring-teal/20 placeholder-transparent"
            />
            <label
              htmlFor="result-location"
              className="absolute left-4 top-1 text-xs text-gray-400 peer-placeholder-shown:top-3 peer-placeholder-shown:text-base peer-focus:top-1 peer-focus:text-xs peer-focus:text-teal transition-all"
            >
              Parkrun location
            </label>
          </div>

          {/* Finish time */}
          <div className="relative">
            <input
              type="text"
              id="result-time"
              value={finishTime}
              onChange={(e) => setFinishTime(e.target.value)}
              onBlur={(e) => validateTime(e.target.value)}
              placeholder=" "
              inputMode="numeric"
              required
              className="peer w-full h-12 px-4 pt-4 pb-1 text-base rounded-xl border-2 border-gray-200 bg-white text-charcoal focus:outline-none focus:border-teal focus:ring-2 focus:ring-teal/20 placeholder-transparent"
            />
            <label
              htmlFor="result-time"
              className="absolute left-4 top-1 text-xs text-gray-400 peer-placeholder-shown:top-3 peer-placeholder-shown:text-base peer-focus:top-1 peer-focus:text-xs peer-focus:text-teal transition-all"
            >
              Finish time (mm:ss)
            </label>
            {timeError && (
              <p className="text-red-500 text-xs mt-1">{timeError}</p>
            )}
          </div>

          <Button
            variant="primary"
            type="submit"
            disabled={!isValid || submitting}
            className="w-full mt-2"
          >
            {submitting ? "Saving…" : "Save Result"}
          </Button>
        </form>
      </main>
    </div>
  );
}
