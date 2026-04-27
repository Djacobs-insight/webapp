"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { BackChevron } from "@/components/ui/back-chevron";
import { getChallengeDetail, respondToChallenge, resolveExpiredChallenges, type ChallengeDetail } from "@/lib/actions/challenges";
import { useAuth } from "@/lib/auth/useAuth";
import { useToast } from "@/components/ui/toast-provider";
import { CelebrationOverlay } from "@/components/ui/celebration-overlay";

const TYPE_LABELS: Record<string, string> = {
  most_runs: "Most Runs",
  best_age_grade: "Best Age Grade",
  fastest_time: "Fastest Time",
};

const SCORE_LABELS: Record<string, string> = {
  most_runs: "runs",
  best_age_grade: "%",
  fastest_time: "pts",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function isExpired(endsAt: string) {
  return new Date(endsAt) <= new Date();
}

function formatScore(score: number, type: string): string {
  if (type === "best_age_grade") return `${score.toFixed(1)}%`;
  if (type === "fastest_time") {
    if (score === 0) return "—";
    const secs = 10000 - score; // reverse the inversion
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  }
  return String(score);
}

export default function ChallengeDetailPage() {
  const params = useParams();
  const challengeId = params.id as string;
  const { account, loading: authLoading } = useAuth();
  const { showToast } = useToast();
  const [challenge, setChallenge] = useState<ChallengeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCelebration, setShowCelebration] = useState(false);

  const loadChallenge = useCallback(async () => {
    // Resolve expired challenges first
    await resolveExpiredChallenges();
    const data = await getChallengeDetail(challengeId);
    setChallenge(data);
    setLoading(false);
  }, [challengeId]);

  useEffect(() => {
    if (!authLoading && account) {
      loadChallenge();
    }
  }, [authLoading, account, loadChallenge]);

  // Auto-refresh every 30 seconds for active challenges
  useEffect(() => {
    if (!challenge || challenge.status !== "active") return;
    const interval = setInterval(loadChallenge, 30000);
    return () => clearInterval(interval);
  }, [challenge, loadChallenge]);

  // Show celebration when challenge just completed and user is the winner
  useEffect(() => {
    if (challenge?.status === "completed" && challenge.winnerName && account?.name === challenge.winnerName) {
      setShowCelebration(true);
    }
  }, [challenge?.status, challenge?.winnerName, account?.name]);

  async function handleRespond(accept: boolean) {
    const result = await respondToChallenge(challengeId, accept);
    if (result.success) {
      showToast("success", accept ? "Challenge accepted!" : "Challenge declined");
      loadChallenge();
    } else {
      showToast("error", result.error);
    }
  }

  if (!account && !authLoading) {
    return (
      <div className="flex flex-col flex-1">
        <BackChevron />
        <main className="flex flex-col flex-1 items-center justify-center px-4">
          <p className="text-gray-500">Sign in to view this challenge.</p>
        </main>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col flex-1">
        <BackChevron />
        <main className="flex flex-col flex-1 items-center justify-center">
          <div className="w-6 h-6 border-2 border-teal border-t-transparent rounded-full animate-spin" />
        </main>
      </div>
    );
  }

  if (!challenge) {
    return (
      <div className="flex flex-col flex-1">
        <BackChevron />
        <main className="flex flex-col flex-1 items-center justify-center px-4">
          <p className="text-gray-500">Challenge not found.</p>
        </main>
      </div>
    );
  }

  const accepted = challenge.participants.filter((p) => p.status === "accepted");
  const pending = challenge.participants.filter((p) => p.status === "pending");
  // eslint-disable-next-line react-hooks/purity
  const daysLeft = Math.max(0, Math.ceil((new Date(challenge.endsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));

  return (
    <div className="flex flex-col flex-1">
      <BackChevron />
      <main className="flex flex-col flex-1 w-full max-w-xl mx-auto px-4 py-6 gap-6">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold text-charcoal">{challenge.name}</h1>
            <span
              className={`text-xs px-2 py-1 rounded-full font-medium ${
                challenge.status === "active"
                  ? "text-teal bg-teal/10"
                  : "text-gray-500 bg-gray-200"
              }`}
            >
              {challenge.status === "active" ? "Active" : "Completed"}
            </span>
          </div>
          <p className="text-sm text-gray-500">
            {TYPE_LABELS[challenge.type] ?? challenge.type} · {formatDate(challenge.startsAt)} – {formatDate(challenge.endsAt)}
          </p>
          <p className="text-sm text-gray-400 mt-1">
            Created by {challenge.createdByName}
            {challenge.status === "active" && !isExpired(challenge.endsAt) && (
              <> · {daysLeft} day{daysLeft !== 1 ? "s" : ""} left</>
            )}
          </p>
        </div>

        {/* Pending invitation for this user */}
        {challenge.myStatus === "pending" && (
          <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4">
            <p className="text-sm text-charcoal font-medium mb-3">You&apos;ve been invited to this challenge!</p>
            <div className="flex gap-2">
              <button
                onClick={() => handleRespond(true)}
                className="flex-1 py-2 rounded-xl bg-teal text-white font-medium text-sm hover:bg-teal/90 transition"
              >
                Accept
              </button>
              <button
                onClick={() => handleRespond(false)}
                className="flex-1 py-2 rounded-xl bg-white border border-gray-200 text-gray-500 font-medium text-sm hover:bg-gray-50 transition"
              >
                Decline
              </button>
            </div>
          </div>
        )}

        {/* Winner banner */}
        {challenge.status === "completed" && (
          <div className="rounded-2xl bg-gradient-to-r from-amber-50 to-amber-100 border border-amber-200 p-4 text-center">
            {challenge.winnerName ? (
              <>
                <p className="text-3xl mb-1">🏆</p>
                <p className="text-lg font-bold text-charcoal">{challenge.winnerName} wins!</p>
              </>
            ) : (
              <>
                <p className="text-3xl mb-1">😅</p>
                <p className="text-sm text-gray-500">No winner — no results recorded during the challenge period</p>
              </>
            )}
          </div>
        )}

        {/* Leaderboard */}
        <div className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="font-bold text-charcoal">
              {challenge.status === "active" ? "Live Standings" : "Final Standings"}
            </h2>
          </div>
          {accepted.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">No accepted participants yet</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {accepted.map((p, i) => {
                const isMe = p.userId === account?.id;
                const isWinner = challenge.status === "completed" && i === 0 && p.score > 0;
                return (
                  <div
                    key={p.userId}
                    className={`flex items-center px-4 py-3 gap-3 ${
                      isMe ? "bg-teal/5" : ""
                    }`}
                  >
                    <span
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold ${
                        i === 0 && p.score > 0
                          ? "bg-amber-100 text-amber-600"
                          : i === 1 && p.score > 0
                            ? "bg-gray-200 text-gray-600"
                            : i === 2 && p.score > 0
                              ? "bg-orange-100 text-orange-600"
                              : "bg-gray-100 text-gray-400"
                      }`}
                    >
                      {i + 1}
                    </span>
                    <span className={`flex-1 font-medium ${isMe ? "text-teal" : "text-charcoal"}`}>
                      {p.name} {isMe && "(you)"}
                    </span>
                    <span className="font-bold text-charcoal">
                      {formatScore(p.score, challenge.type)}{" "}
                      <span className="text-xs text-gray-400 font-normal">
                        {SCORE_LABELS[challenge.type] ?? ""}
                      </span>
                    </span>
                    {isWinner && <span className="text-lg">🏆</span>}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Pending participants */}
        {pending.length > 0 && (
          <div className="rounded-2xl bg-gray-50 border border-gray-100 p-4">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Awaiting Response
            </h3>
            <div className="flex flex-wrap gap-2">
              {pending.map((p) => (
                <span
                  key={p.userId}
                  className="text-sm text-gray-500 bg-white border border-gray-200 px-3 py-1 rounded-full"
                >
                  {p.name}
                </span>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Winner celebration */}
      {showCelebration && (
        <CelebrationOverlay
          milestones={[{ type: "challenge", value: challenge.id, label: `You won "${challenge.name}"! 🏆` }]}
          onDismiss={() => setShowCelebration(false)}
        />
      )}
    </div>
  );
}
