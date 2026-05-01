"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth/useAuth";
import { submitResult } from "@/lib/actions/results";
import { getUserHomeEvent } from "@/lib/actions/profile";
import { useToast } from "@/components/ui/toast-provider";
import { useOptimisticResult } from "@/lib/optimistic-result-context";
import { BackChevron } from "@/components/ui/back-chevron";
import { Button } from "@/components/ui/button";
import Image from "next/image";

function AddResultPageInner() {
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
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<"idle" | "uploading" | "done">("idle");
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      showToast("error", "Only JPEG, PNG, and WebP images are allowed");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      showToast("error", "Photo must be smaller than 10 MB");
      return;
    }
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  }

  function removePhoto() {
    setPhotoFile(null);
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!isValid || submitting) return;

    setSubmitting(true);

    // Upload photo first if selected
    let photoData: { displayUrl: string; thumbnailUrl: string; originalName: string | null } | undefined;
    if (photoFile) {
      setUploadProgress("uploading");
      try {
        const formDataUpload = new FormData();
        formDataUpload.append("file", photoFile);
        const res = await fetch("/api/upload", { method: "POST", body: formDataUpload });
        if (!res.ok) {
          const err = await res.json();
          showToast("error", err.error || "Photo upload failed");
          setSubmitting(false);
          setUploadProgress("idle");
          return;
        }
        const json = await res.json();
        photoData = { displayUrl: json.displayUrl, thumbnailUrl: json.thumbnailUrl, originalName: json.originalName };
        setUploadProgress("done");
      } catch {
        showToast("error", "Photo upload failed");
        setSubmitting(false);
        setUploadProgress("idle");
        return;
      }
    }

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
    const result = await submitResult({ date, location: location.trim(), finishTime, photo: photoData });
    setSubmitting(false);

    if (result.success) {
      // Mark optimistic as confirmed — dashboard will refresh real data
      setOptimisticResult((prev) => prev ? { ...prev, pending: false, ageGradedPct: result.ageGradedPct } : null);
      const msg = result.ageGradedPct
        ? `Result saved! Age-graded: ${result.ageGradedPct.toFixed(1)}%`
        : "Result saved!";
      showToast("success", msg);
      if (result.milestones.length > 0 || result.badges.length > 0) {
        const allCelebrations = [
          ...result.milestones,
          ...result.badges.map((b) => ({ type: "badge", value: b.key, label: b.label })),
        ];
        setCelebrationMilestones(allCelebrations);
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
              onChange={(e) => {
                // Auto-format mm:ss while typing — user types only digits.
                // Mobile numeric keypads (inputMode="numeric") often hide ':',
                // so we insert it automatically once 3+ digits are entered.
                const digits = e.target.value.replace(/\D/g, "").slice(0, 5);
                let formatted = digits;
                if (digits.length >= 3) {
                  const ss = digits.slice(-2);
                  const mm = digits.slice(0, digits.length - 2);
                  formatted = `${mm}:${ss}`;
                }
                setFinishTime(formatted);
              }}
              onBlur={(e) => validateTime(e.target.value)}
              placeholder=" "
              inputMode="numeric"
              pattern="[0-9:]*"
              autoComplete="off"
              maxLength={6}
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

          {/* Photo upload */}
          <div className="flex flex-col gap-2">
            <label className="text-xs text-gray-400">Photo (optional)</label>
            {photoPreview ? (
              <div className="relative w-full rounded-xl overflow-hidden border-2 border-gray-200">
                <Image
                  src={photoPreview}
                  alt="Photo preview"
                  width={400}
                  height={300}
                  className="w-full h-48 object-cover"
                  unoptimized
                />
                <button
                  type="button"
                  onClick={removePhoto}
                  className="absolute top-2 right-2 w-8 h-8 rounded-full bg-charcoal/70 text-white flex items-center justify-center text-lg leading-none"
                  aria-label="Remove photo"
                >
                  ×
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full h-24 rounded-xl border-2 border-dashed border-gray-300 bg-white flex flex-col items-center justify-center gap-1 text-gray-400 hover:border-teal hover:text-teal transition-colors"
              >
                <span className="text-2xl">📷</span>
                <span className="text-sm">Add a photo</span>
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handlePhotoSelect}
              className="hidden"
            />
            {uploadProgress === "uploading" && (
              <p className="text-xs text-teal">Uploading photo…</p>
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

export default function AddResultPage() {
  return (
    <Suspense>
      <AddResultPageInner />
    </Suspense>
  );
}
