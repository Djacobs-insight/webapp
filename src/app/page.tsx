"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/useAuth";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { getRecentResults, getFamilyResults, getDashboardData } from "@/lib/actions/results";
import { type ActivityItem } from "@/lib/actions/cheers";
import { useOptimisticResult } from "@/lib/optimistic-result-context";

export default function DashboardPage() {
  const { account, loading, login } = useAuth();

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center min-h-screen">
        <div className="w-10 h-10 rounded-full border-4 border-coral border-t-transparent animate-spin" aria-label="Loading" />
      </div>
    );
  }

  if (!account) {
    return <LandingScreen onSignIn={login} />;
  }

  return <AuthenticatedDashboard name={account.name ?? account.email ?? "Runner"} />;
}

function LandingScreen({ onSignIn }: { onSignIn: () => void }) {
  return (
    <main className="flex flex-col flex-1 items-center justify-center min-h-screen px-6 gap-8 text-center">
      {/* Logo / wordmark */}
      <div className="flex flex-col items-center gap-3">
        <span className="text-5xl" role="img" aria-label="Running shoe">👟</span>
        <h1 className="text-3xl font-bold text-charcoal">Saturday Morning</h1>
        <p className="text-lg text-gray-500 max-w-xs">
          Family parkrun, together — wherever you are in the world.
        </p>
      </div>

      {/* Value props */}
      <ul className="flex flex-col gap-2 text-left text-base text-charcoal w-full max-w-xs">
        {[
          "🏃 Log your parkrun time in under 15 seconds",
          "🏆 Compete fairly with age-graded scores",
          "🎉 Celebrate every result with your family",
          "📍 Works across time zones — all day Saturday",
        ].map((item) => (
          <li key={item} className="flex gap-2">{item}</li>
        ))}
      </ul>

      <Button variant="primary" onClick={onSignIn} className="w-full max-w-xs">
        Get started — it&apos;s free
      </Button>

      <p className="text-sm text-gray-400">
        Already have an account?{" "}
        <button onClick={onSignIn} className="text-teal underline">Sign in</button>
      </p>
    </main>
  );
}

function AuthenticatedDashboard({ name }: { name: string }) {
  const firstName = name.split(" ")[0];
  const [results, setResults] = useState<Awaited<ReturnType<typeof getRecentResults>>>([]);
  const [familyResults, setFamilyResults] = useState<Awaited<ReturnType<typeof getFamilyResults>>>({ results: [], members: [] });
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [summary, setSummary] = useState<{ personalBest: string; streak: string }>({ personalBest: "—", streak: "—" });
  const { optimisticResult, clearOptimistic } = useOptimisticResult();

  const refreshResults = () => {
    return getDashboardData().then((d) => {
      setSummary(d.summary);
      setActivity(d.activity);
      setFamilyResults(d.family);
      setResults(d.recent);
    });
  };

  useEffect(() => {
    refreshResults();
  }, []);

  // When optimistic result becomes non-pending (server responded), refresh real data
  useEffect(() => {
    if (optimisticResult && !optimisticResult.pending) {
      refreshResults().then(clearOptimistic);
    }
  }, [optimisticResult, clearOptimistic]);

  // Build display list: prepend optimistic result if pending
  const displayResults = optimisticResult?.pending
    ? [optimisticResult, ...results]
    : results;

  // Merge personal results + family activity into a unified feed
  type FeedItem =
    | { kind: "result"; id: string; runnerName: string; location: string; date: string; finishTimeSecs: number; ageGradedPct: number | null; isMine: boolean; isPending: boolean }
    | { kind: "activity"; id: string; actorName: string; action: string; target: string; resultId?: string; createdAt: string; type: ActivityItem["type"] };

  const feedItems: FeedItem[] = [];

  // Add family results (includes yours)
  for (const r of familyResults.results) {
    feedItems.push({
      kind: "result",
      id: r.id,
      runnerName: r.runnerName,
      location: r.location,
      date: r.date,
      finishTimeSecs: r.finishTimeSecs,
      ageGradedPct: r.ageGradedPct,
      isMine: false, // family results
      isPending: false,
    });
  }

  // If no family results, fall back to personal results
  if (familyResults.results.length === 0) {
    for (const r of displayResults) {
      const isPending = "pending" in r && (r as { pending?: boolean }).pending === true;
      feedItems.push({
        kind: "result",
        id: r.id,
        runnerName: firstName,
        location: r.location,
        date: r.date,
        finishTimeSecs: r.finishTimeSecs,
        ageGradedPct: r.ageGradedPct,
        isMine: true,
        isPending,
      });
    }
  }

  // Add activity items (comments, reactions, cheers, milestones — not results, already shown)
  for (const a of activity.filter((a) => a.type !== "result")) {
    feedItems.push({
      kind: "activity",
      id: a.id,
      actorName: a.actorName,
      action: a.action,
      target: a.target,
      resultId: a.resultId,
      createdAt: a.createdAt,
      type: a.type,
    });
  }

  const ACTIVITY_EMOJI: Record<string, string> = {
    comment: "💬",
    reaction: "👏",
    cheer: "📣",
    milestone: "🏅",
  };

  return (
    <main className="flex flex-col flex-1 w-full max-w-xl mx-auto px-4 pt-4 pb-20 gap-0">
      {/* Sticky header with stats ribbon */}
      <header className="sticky top-0 z-10 bg-warm-white pb-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Saturday Morning</p>
            <h1 className="text-xl font-bold text-charcoal">
              {firstName}&apos;s Feed 👋
            </h1>
          </div>
          <Link
            href="/results/new"
            className="flex items-center justify-center w-11 h-11 rounded-full bg-coral text-warm-white shadow-md hover:bg-coral/90 transition focus:outline-none focus:ring-2 focus:ring-teal"
            aria-label="Enter today's result"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </Link>
        </div>

        {/* Stats ribbon */}
        <div className="flex gap-2 mt-3">
          <div className="flex-1 rounded-xl bg-white border border-gray-100 shadow-sm px-3 py-2 flex items-center gap-2">
            <span className="text-lg">🔥</span>
            <div>
              <p className="text-[11px] text-gray-400 leading-tight">Streak</p>
              <p className="text-sm font-bold text-charcoal leading-tight">{summary.streak}</p>
            </div>
          </div>
          <div className="flex-1 rounded-xl bg-white border border-gray-100 shadow-sm px-3 py-2 flex items-center gap-2">
            <span className="text-lg">⚡</span>
            <div>
              <p className="text-[11px] text-gray-400 leading-tight">PB</p>
              <p className="text-sm font-bold text-charcoal leading-tight">{summary.personalBest}</p>
            </div>
          </div>
          <div className="flex-1 rounded-xl bg-white border border-gray-100 shadow-sm px-3 py-2 flex items-center gap-2">
            <span className="text-lg">👥</span>
            <div>
              <p className="text-[11px] text-gray-400 leading-tight">Family</p>
              <p className="text-sm font-bold text-charcoal leading-tight">{familyResults.members.length || "—"}</p>
            </div>
          </div>
        </div>
      </header>

      {/* Unified feed */}
      {feedItems.length === 0 ? (
        <section className="mt-6">
          <EmptyState
            title="Your feed is empty"
            description="Enter your first parkrun result or invite family members to get started."
            icon={<span className="text-4xl">🏃</span>}
            action={
              <Link href="/results/new">
                <Button variant="primary" className="mt-2">Enter a result</Button>
              </Link>
            }
          />
        </section>
      ) : (
        <ul className="flex flex-col gap-3 mt-2">
          {feedItems.map((item) => {
            if (item.kind === "result") {
              return (
                <li key={`r-${item.id}`}>
                  <Link
                    href={`/board/${item.id}`}
                    className="block rounded-2xl border border-gray-100 bg-white shadow-sm p-4 hover:bg-gray-50 transition"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <span className="flex items-center justify-center w-8 h-8 rounded-full bg-teal/10 text-teal text-sm font-bold">
                          {item.runnerName.charAt(0).toUpperCase()}
                        </span>
                        <div>
                          <p className="text-sm font-bold text-charcoal">{item.runnerName}</p>
                          <p className="text-xs text-gray-400">{item.location} · {item.date}</p>
                        </div>
                      </div>
                      {item.isPending && (
                        <div className="w-4 h-4 rounded-full border-2 border-coral border-t-transparent animate-spin" />
                      )}
                    </div>
                    <div className="flex items-baseline gap-3 mt-3">
                      <p className="text-2xl font-bold text-teal tabular-nums">
                        {Math.floor(item.finishTimeSecs / 60)}:{String(item.finishTimeSecs % 60).padStart(2, "0")}
                      </p>
                      {item.ageGradedPct != null && (
                        <p className="text-sm text-gray-500">{item.ageGradedPct.toFixed(1)}% AG</p>
                      )}
                    </div>
                  </Link>
                </li>
              );
            }

            // Activity item (comment, reaction, cheer, milestone)
            return (
              <li key={`a-${item.id}`}>
                <div className="flex items-start gap-3 rounded-2xl border border-gray-100 bg-white shadow-sm px-4 py-3">
                  <span className="text-xl mt-0.5">{ACTIVITY_EMOJI[item.type] ?? "📣"}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-charcoal">
                      <span className="font-bold">{item.actorName}</span>{" "}
                      {item.action}{" "}
                      <span className="text-gray-500">{item.target}</span>
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">{formatTimeAgo(item.createdAt)}</p>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}

function formatTimeAgo(isoString: string): string {
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const diffMins = Math.floor((now - then) / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return `${Math.floor(diffDays / 7)}w ago`;
}
