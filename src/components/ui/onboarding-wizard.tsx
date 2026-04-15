"use client";
import React, { useState, useEffect } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "sm_onboarding_completed";

// Per-step schemas
const nameSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
});

const birthdaySchema = z.object({
  birthday: z.string().min(1, "Please enter your birthday"),
});

const parkrunSchema = z.object({
  parkrunHomeEvent: z.string().min(2, "Please enter your home parkrun event"),
});

type Step = "welcome" | "name" | "birthday" | "parkrun" | "done";

const STEPS: Step[] = ["welcome", "name", "birthday", "parkrun", "done"];

interface WizardData {
  name: string;
  birthday: string;
  parkrunHomeEvent: string;
}

interface OnboardingWizardProps {
  /** Called when wizard finishes or is skipped with collected data */
  onComplete: (data: Partial<WizardData>) => void;
}

export function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const [step, setStep] = useState<Step>("welcome");
  const [data, setData] = useState<Partial<WizardData>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const stepIndex = STEPS.indexOf(step);
  const totalSteps = STEPS.length - 2; // exclude welcome + done from count

  const skip = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, "true");
    }
    onComplete({});
  };

  const advance = () => setStep(STEPS[stepIndex + 1]);

  const handleName = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const result = nameSchema.safeParse({ name: data.name ?? "" });
    if (!result.success) {
      setErrors({ name: result.error.issues[0].message });
      return;
    }
    setErrors({});
    advance();
  };

  const handleBirthday = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const result = birthdaySchema.safeParse({ birthday: data.birthday ?? "" });
    if (!result.success) {
      setErrors({ birthday: result.error.issues[0].message });
      return;
    }
    setErrors({});
    advance();
  };

  const handleParkrun = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const result = parkrunSchema.safeParse({ parkrunHomeEvent: data.parkrunHomeEvent ?? "" });
    if (!result.success) {
      setErrors({ parkrunHomeEvent: result.error.issues[0].message });
      return;
    }
    setErrors({});
    advance();
  };

  const finish = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, "true");
    }
    onComplete(data);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Onboarding wizard"
    >
      <div className="w-full max-w-md bg-warm-white rounded-3xl shadow-2xl p-8 flex flex-col gap-6 relative">

        {/* Skip button */}
        {step !== "done" && (
          <button
            onClick={skip}
            className="absolute top-4 right-5 text-sm text-gray-400 hover:text-gray-600 transition"
            aria-label="Skip onboarding"
          >
            Skip
          </button>
        )}

        {/* Progress dots */}
        {step !== "welcome" && step !== "done" && (
          <div className="flex gap-2 justify-center">
            {["name", "birthday", "parkrun"].map((s, i) => (
              <span
                key={s}
                className={`w-2 h-2 rounded-full transition-colors ${
                  STEPS.indexOf(step) > i + 1 || step === s
                    ? "bg-coral"
                    : "bg-gray-200"
                }`}
              />
            ))}
          </div>
        )}

        {/* Step content */}
        {step === "welcome" && (
          <WelcomeStep onNext={advance} onSkip={skip} />
        )}
        {step === "name" && (
          <NameStep
            value={data.name ?? ""}
            error={errors.name}
            onChange={(v) => setData((d) => ({ ...d, name: v }))}
            onSubmit={handleName}
          />
        )}
        {step === "birthday" && (
          <BirthdayStep
            value={data.birthday ?? ""}
            error={errors.birthday}
            onChange={(v) => setData((d) => ({ ...d, birthday: v }))}
            onSubmit={handleBirthday}
          />
        )}
        {step === "parkrun" && (
          <ParkrunStep
            value={data.parkrunHomeEvent ?? ""}
            error={errors.parkrunHomeEvent}
            onChange={(v) => setData((d) => ({ ...d, parkrunHomeEvent: v }))}
            onSubmit={handleParkrun}
          />
        )}
        {step === "done" && (
          <DoneStep name={data.name} onFinish={finish} />
        )}
      </div>
    </div>
  );
}

function WelcomeStep({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) {
  return (
    <div className="flex flex-col items-center gap-5 text-center">
      <span className="text-6xl">👟</span>
      <h2 className="text-2xl font-bold text-charcoal">Welcome to Saturday Morning!</h2>
      <p className="text-gray-500 text-base">
        Let&apos;s get you set up in 3 quick steps so age-grading works perfectly for you.
      </p>
      <Button variant="primary" onClick={onNext} className="w-full">
        Let&apos;s go →
      </Button>
      <button onClick={onSkip} className="text-sm text-gray-400 hover:text-gray-600">
        I&apos;ll do this later
      </button>
    </div>
  );
}

function NameStep({
  value, error, onChange, onSubmit,
}: {
  value: string; error?: string; onChange: (v: string) => void; onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1 text-center">
        <span className="text-4xl mb-1">👋</span>
        <h2 className="text-xl font-bold text-charcoal">What&apos;s your name?</h2>
        <p className="text-sm text-gray-500">This is how your family will see you on the leaderboard.</p>
      </div>
      <div className="flex flex-col gap-1">
        <input
          type="text"
          placeholder="Your display name"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-xl border-2 border-gray-200 focus:border-coral outline-none px-4 py-3 text-base text-charcoal bg-white transition"
          autoFocus
          autoComplete="given-name"
        />
        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>
      <Button type="submit" variant="primary" className="w-full">
        Continue →
      </Button>
    </form>
  );
}

function BirthdayStep({
  value, error, onChange, onSubmit,
}: {
  value: string; error?: string; onChange: (v: string) => void; onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1 text-center">
        <span className="text-4xl mb-1">🎂</span>
        <h2 className="text-xl font-bold text-charcoal">When&apos;s your birthday?</h2>
        <p className="text-sm text-gray-500">We use this to calculate your age-graded score — it&apos;s what makes the competition fair!</p>
      </div>
      <div className="flex flex-col gap-1">
        <input
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          max={new Date(Date.now() - 18 * 365.25 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]}
          className="w-full rounded-xl border-2 border-gray-200 focus:border-coral outline-none px-4 py-3 text-base text-charcoal bg-white transition"
        />
        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>
      <Button type="submit" variant="primary" className="w-full">
        Continue →
      </Button>
    </form>
  );
}

function ParkrunStep({
  value, error, onChange, onSubmit,
}: {
  value: string; error?: string; onChange: (v: string) => void; onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1 text-center">
        <span className="text-4xl mb-1">📍</span>
        <h2 className="text-xl font-bold text-charcoal">Your home parkrun</h2>
        <p className="text-sm text-gray-500">Which parkrun do you usually run? (e.g. Bushy Park, Parklands)</p>
      </div>
      <div className="flex flex-col gap-1">
        <input
          type="text"
          placeholder="e.g. Bushy Park"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-xl border-2 border-gray-200 focus:border-coral outline-none px-4 py-3 text-base text-charcoal bg-white transition"
          autoComplete="off"
        />
        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>
      <Button type="submit" variant="primary" className="w-full">
        Continue →
      </Button>
    </form>
  );
}

function DoneStep({ name, onFinish }: { name?: string; onFinish: () => void }) {
  return (
    <div className="flex flex-col items-center gap-5 text-center">
      <span className="text-6xl">🎉</span>
      <h2 className="text-2xl font-bold text-charcoal">
        You&apos;re all set{name ? `, ${name.split(" ")[0]}` : ""}!
      </h2>
      <p className="text-gray-500 text-base">
        Now invite your family to join and see who&apos;ll be crowned Saturday&apos;s champion!
      </p>
      <Button variant="primary" onClick={onFinish} className="w-full">
        Go to my dashboard →
      </Button>
    </div>
  );
}

/** Returns true if onboarding has already been completed */
export function isOnboardingCompleted(): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(STORAGE_KEY) === "true";
}
