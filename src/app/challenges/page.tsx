"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { BackChevron } from "@/components/ui/back-chevron";
import { getChallenges, respondToChallenge, type ChallengeListItem } from "@/lib/actions/challenges";
import { useAuth } from "@/lib/auth/useAuth";
import { useToast } from "@/components/ui/toast-provider";

const TYPE_LABELS: Record<string, string> = {
  most_runs: "Most Runs",
  best_age_grade: "Best Age Grade",
  fastest_time: "Fastest Time",
};

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export default function ChallengesPage() {
  const { account, loading: authLoading } = useAuth();
  const { showToast } = useToast();
  const [challenges, setChallenges] = useState<ChallengeListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && account) {
      getChallenges().then((data) => {
        setChallenges(data);
        setLoading(false);
      });
    }
  }, [authLoading, account]);

  async function handleRespond(challengeId: string, accept: boolean) {
    const result = await respondToChallenge(challengeId, accept);
    if (result.success) {
      showToast("success", accept ? "Challenge accepted!" : "Challenge declined");
      setChallenges((prev) =>
        prev.map((c) =>
          c.id === challengeId ? { ...c, myStatus: accept ? "accepted" : "declined" } : c,
        ),
      );
    } else {
      showToast("error", result.error);
    }
  }

  if (!account && !authLoading) {
    return (
      <div className="flex flex-col flex-1">
        <BackChevron />
        <main className="flex flex-col flex-1 items-center justify-center px-4">
          <p className="text-gray-500">Sign in to view challenges.</p>
        </main>
      </div>
    );
  }

  const active = challenges.filter((c) => c.status === "active");
  const completed = challenges.filter((c) => c.status === "completed");
  const pending = challenges.filter((c) => c.myStatus === "pending");

  return (
    <div className="flex flex-col flex-1">
      <BackChevron />
      <main className="flex flex-col flex-1 w-full max-w-xl mx-auto px-4 py-6 gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-charcoal">Challenges</h1>
          <Link
            href="/challenges/new"
            className="px-4 py-2 rounded-xl bg-coral text-white font-medium text-sm hover:bg-coral/90 transition"
          >
            Create
          </Link>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-teal border-t-transparent rounded-full animate-spin" />
          </div>
        ) : challenges.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <p className="text-4xl mb-3">🏆</p>
            <p className="text-sm">No challenges yet</p>
            <p className="text-xs mt-1">Create one to get the competition started!</p>
          </div>
        ) : (
          <>
            {/* Pending invitations */}
            {pending.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                  Pending Invitations
                </h2>
                <div className="flex flex-col gap-3">
                  {pending.map((c) => (
                    <div
                      key={c.id}
                      className="rounded-2xl bg-amber-50 border border-amber-200 p-4"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-bold text-charcoal">{c.name}</h3>
                        <span className="text-xs text-amber-600 bg-amber-100 px-2 py-1 rounded-full">
                          {TYPE_LABELS[c.type] ?? c.type}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 mb-3">
                        {formatDate(c.startsAt)} – {formatDate(c.endsAt)} · by {c.createdByName}
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleRespond(c.id, true)}
                          className="flex-1 py-2 rounded-xl bg-teal text-white font-medium text-sm hover:bg-teal/90 transition"
                        >
                          Accept
                        </button>
                        <button
                          onClick={() => handleRespond(c.id, false)}
                          className="flex-1 py-2 rounded-xl bg-white border border-gray-200 text-gray-500 font-medium text-sm hover:bg-gray-50 transition"
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Active challenges */}
            {active.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                  Active
                </h2>
                <div className="flex flex-col gap-3">
                  {active.map((c) => (
                    <Link
                      key={c.id}
                      href={`/challenges/${c.id}`}
                      className="rounded-2xl bg-white border border-gray-100 shadow-sm p-4 hover:shadow-md transition"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="font-bold text-charcoal">{c.name}</h3>
                        <span className="text-xs text-teal bg-teal/10 px-2 py-1 rounded-full">
                          {TYPE_LABELS[c.type] ?? c.type}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500">
                        {formatDate(c.startsAt)} – {formatDate(c.endsAt)} · {c.participantCount} participant{c.participantCount !== 1 ? "s" : ""}
                      </p>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Completed challenges */}
            {completed.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                  Completed
                </h2>
                <div className="flex flex-col gap-3">
                  {completed.map((c) => (
                    <Link
                      key={c.id}
                      href={`/challenges/${c.id}`}
                      className="rounded-2xl bg-gray-50 border border-gray-100 p-4 hover:bg-gray-100 transition"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="font-bold text-charcoal">{c.name}</h3>
                        <span className="text-xs text-gray-500 bg-gray-200 px-2 py-1 rounded-full">
                          Completed
                        </span>
                      </div>
                      <p className="text-sm text-gray-500">
                        {c.winnerName ? `🏆 Winner: ${c.winnerName}` : "No winner — no results recorded"}
                      </p>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
