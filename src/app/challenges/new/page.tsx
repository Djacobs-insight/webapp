"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { BackChevron } from "@/components/ui/back-chevron";
import { createChallenge, getFamilyMembers } from "@/lib/actions/challenges";
import { useAuth } from "@/lib/auth/useAuth";
import { useToast } from "@/components/ui/toast-provider";

const CHALLENGE_TYPES = [
  { value: "most_runs", label: "Most Runs", description: "Who can log the most parkruns" },
  { value: "best_age_grade", label: "Best Age Grade", description: "Highest age-graded % in a single run" },
  { value: "fastest_time", label: "Fastest Time", description: "Fastest single parkrun finish" },
];

export default function NewChallengePage() {
  const { account, loading: authLoading } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();

  const [name, setName] = useState("");
  const [type, setType] = useState("most_runs");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [members, setMembers] = useState<{ userId: string; name: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [loadingMembers, setLoadingMembers] = useState(true);

  useEffect(() => {
    if (!authLoading && account) {
      getFamilyMembers().then((data) => {
        setMembers(data);
        setLoadingMembers(false);
      });
    }
  }, [authLoading, account]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;

    if (selectedMembers.length === 0) {
      showToast("error", "Select at least one family member");
      return;
    }

    setSubmitting(true);
    const result = await createChallenge({
      name: name.trim(),
      type,
      startsAt,
      endsAt,
      invitedUserIds: selectedMembers,
    });

    if (result.success) {
      showToast("success", "Challenge created!");
      router.push(`/challenges/${result.challengeId}`);
    } else {
      showToast("error", result.error);
      setSubmitting(false);
    }
  }

  function toggleMember(userId: string) {
    setSelectedMembers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    );
  }

  const today = new Date().toISOString().split("T")[0];

  if (!account && !authLoading) {
    return (
      <div className="flex flex-col flex-1">
        <BackChevron />
        <main className="flex flex-col flex-1 items-center justify-center px-4">
          <p className="text-gray-500">Sign in to create challenges.</p>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1">
      <BackChevron />
      <main className="flex flex-col flex-1 w-full max-w-xl mx-auto px-4 py-6 gap-6">
        <h1 className="text-2xl font-bold text-charcoal">Create Challenge</h1>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* Name */}
          <div className="relative">
            <input
              type="text"
              id="challenge-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={100}
              placeholder=" "
              className="peer w-full h-12 px-4 pt-4 pb-1 text-base rounded-xl border-2 border-gray-200 bg-white text-charcoal focus:outline-none focus:border-teal focus:ring-2 focus:ring-teal/20"
            />
            <label
              htmlFor="challenge-name"
              className="absolute left-4 top-1 text-xs text-gray-400 peer-placeholder-shown:top-3 peer-placeholder-shown:text-base peer-focus:top-1 peer-focus:text-xs peer-focus:text-teal transition-all"
            >
              Challenge Name
            </label>
          </div>

          {/* Type */}
          <div>
            <p className="text-sm font-medium text-gray-500 mb-2">Challenge Type</p>
            <div className="flex flex-col gap-2">
              {CHALLENGE_TYPES.map((ct) => (
                <button
                  key={ct.value}
                  type="button"
                  onClick={() => setType(ct.value)}
                  className={`flex flex-col rounded-xl border-2 px-4 py-3 text-left transition ${
                    type === ct.value
                      ? "border-teal bg-teal/5"
                      : "border-gray-200 bg-white hover:border-gray-300"
                  }`}
                >
                  <span className="font-medium text-charcoal">{ct.label}</span>
                  <span className="text-xs text-gray-400">{ct.description}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div className="relative">
              <input
                type="date"
                id="starts-at"
                value={startsAt}
                min={today}
                onChange={(e) => setStartsAt(e.target.value)}
                required
                className="peer w-full h-12 px-4 pt-4 pb-1 text-base rounded-xl border-2 border-gray-200 bg-white text-charcoal focus:outline-none focus:border-teal focus:ring-2 focus:ring-teal/20"
              />
              <label
                htmlFor="starts-at"
                className="absolute left-4 top-1 text-xs text-gray-400 peer-focus:text-teal transition-all"
              >
                Start Date
              </label>
            </div>
            <div className="relative">
              <input
                type="date"
                id="ends-at"
                value={endsAt}
                min={startsAt || today}
                onChange={(e) => setEndsAt(e.target.value)}
                required
                className="peer w-full h-12 px-4 pt-4 pb-1 text-base rounded-xl border-2 border-gray-200 bg-white text-charcoal focus:outline-none focus:border-teal focus:ring-2 focus:ring-teal/20"
              />
              <label
                htmlFor="ends-at"
                className="absolute left-4 top-1 text-xs text-gray-400 peer-focus:text-teal transition-all"
              >
                End Date
              </label>
            </div>
          </div>

          {/* Family members */}
          <div>
            <p className="text-sm font-medium text-gray-500 mb-2">Invite Family Members</p>
            {loadingMembers ? (
              <div className="flex items-center justify-center py-4">
                <div className="w-5 h-5 border-2 border-teal border-t-transparent rounded-full animate-spin" />
              </div>
            ) : members.length === 0 ? (
              <p className="text-sm text-gray-400 py-2">
                No other family members found. Invite someone to your family first!
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {members.map((m) => (
                  <button
                    key={m.userId}
                    type="button"
                    onClick={() => toggleMember(m.userId)}
                    className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3 transition ${
                      selectedMembers.includes(m.userId)
                        ? "border-teal bg-teal/5"
                        : "border-gray-200 bg-white hover:border-gray-300"
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition ${
                        selectedMembers.includes(m.userId)
                          ? "border-teal bg-teal"
                          : "border-gray-300"
                      }`}
                    >
                      {selectedMembers.includes(m.userId) && (
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                          <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                    <span className="font-medium text-charcoal">{m.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={submitting || members.length === 0}
            className="w-full py-3 rounded-xl bg-coral text-white font-bold text-base shadow-sm hover:bg-coral/90 active:scale-[0.98] transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "Creating…" : "Create Challenge"}
          </button>
        </form>
      </main>
    </div>
  );
}
