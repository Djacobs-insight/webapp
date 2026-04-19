"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth/useAuth";
import { getLeaderboard, getFamilyResults } from "@/lib/actions/results";
import type { LeaderboardPeriod } from "@/lib/actions/results";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";

type LeaderboardEntry = Awaited<ReturnType<typeof getLeaderboard>>["entries"][number];
type FamilyResult = Awaited<ReturnType<typeof getFamilyResults>>["results"][number];

const PERIODS: { key: LeaderboardPeriod; label: string }[] = [
  { key: "weekly", label: "This Week" },
  { key: "monthly", label: "This Month" },
  { key: "all-time", label: "All Time" },
];

export default function BoardPage() {
  const { account, loading } = useAuth();
  const [period, setPeriod] = useState<LeaderboardPeriod>("weekly");
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [currentUserId, setCurrentUserId] = useState("");
  const [results, setResults] = useState<FamilyResult[]>([]);
  const [fetched, setFetched] = useState(false);
  const fetchingRef = useRef(false);

  useEffect(() => {
    if (!account) return;
    fetchingRef.current = true;
    Promise.all([
      getLeaderboard(period),
      getFamilyResults(),
    ]).then(([lb, fr]) => {
      setEntries(lb.entries);
      setCurrentUserId(lb.currentUserId);
      setResults(fr.results);
      setFetched(true);
      fetchingRef.current = false;
    });
  }, [account, period]);

  if (loading || (account && !fetched)) {
    return (
      <div className="flex flex-1 items-center justify-center min-h-screen">
        <div className="w-10 h-10 rounded-full border-4 border-coral border-t-transparent animate-spin" aria-label="Loading" />
      </div>
    );
  }

  if (!account) {
    return (
      <main className="flex flex-col flex-1 items-center justify-center px-6">
        <EmptyState
          title="Sign in to view results"
          description="See your family's parkrun results here."
          icon={<span>📊</span>}
        />
      </main>
    );
  }

  const hasRankedEntries = entries.some((e) => e.bestAgeGradedPct != null);

  // Group recent results by week
  const grouped: { label: string; items: FamilyResult[] }[] = [];
  for (const r of results) {
    const last = grouped[grouped.length - 1];
    if (last && last.label === r.weekLabel) {
      last.items.push(r);
    } else {
      grouped.push({ label: r.weekLabel, items: [r] });
    }
  }

  return (
    <main className="flex flex-col flex-1 w-full max-w-xl mx-auto px-4 py-6 gap-6">
      {/* Leaderboard section */}
      <section>
        <h1 className="text-2xl font-bold text-charcoal mb-4">Leaderboard</h1>

        {/* Period tabs */}
        <div className="flex rounded-xl bg-gray-100 p-1 mb-4">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`flex-1 text-sm font-medium py-2 rounded-lg transition ${
                period === p.key
                  ? "bg-white text-charcoal shadow-sm"
                  : "text-gray-400 hover:text-charcoal"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Leaderboard table */}
        {!hasRankedEntries ? (
          <EmptyState
            title="No ranked results"
            description={period === "all-time"
              ? "Add age-grading data (birthday & gender in profile) to appear on the leaderboard."
              : "No age-graded results for this period yet."
            }
            icon={<span>🏆</span>}
          />
        ) : (
          <div className="flex flex-col gap-1">
            {entries.map((entry, idx) => {
              const rank = entry.bestAgeGradedPct != null ? idx + 1 : null;
              const isCurrentUser = entry.userId === currentUserId;
              return (
                <div
                  key={entry.userId}
                  className={`flex items-center gap-3 py-3 px-3 rounded-xl transition ${
                    isCurrentUser ? "bg-teal/10 ring-1 ring-teal/30" : "hover:bg-gray-50"
                  }`}
                >
                  {/* Rank */}
                  <div className="w-8 text-center">
                    {rank === 1 ? (
                      <span className="text-xl">👑</span>
                    ) : rank != null ? (
                      <span className="text-sm font-bold text-gray-400">{rank}</span>
                    ) : (
                      <span className="text-sm text-gray-300">—</span>
                    )}
                  </div>
                  {/* Name */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${isCurrentUser ? "text-teal" : "text-charcoal"}`}>
                      {entry.name}
                      {isCurrentUser && <span className="ml-1 text-xs text-gray-400">(you)</span>}
                    </p>
                    <p className="text-xs text-gray-400">
                      {entry.runs} {entry.runs === 1 ? "run" : "runs"}
                    </p>
                  </div>
                  {/* Score */}
                  <div className="text-right">
                    {entry.bestAgeGradedPct != null ? (
                      <p className="text-lg font-bold text-teal tabular-nums">
                        {entry.bestAgeGradedPct.toFixed(1)}%
                      </p>
                    ) : (
                      <p className="text-sm text-gray-300">—</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Recent Results section */}
      <section>
        <h2 className="text-lg font-bold text-charcoal mb-3">Recent Results</h2>
        {results.length === 0 ? (
          <EmptyState
            title="No results yet"
            description="Enter your first parkrun result to get started!"
            icon={<span>🏃</span>}
            action={
              <Link href="/results/new">
                <Button variant="primary" className="mt-2">Add a result</Button>
              </Link>
            }
          />
        ) : (
          <div className="flex flex-col gap-4">
            {grouped.map((group) => (
              <div key={group.label}>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{group.label}</h3>
                <ul className="flex flex-col gap-1">
                  {group.items.map((r) => (
                    <li key={r.id}>
                      <Link
                        href={`/board/${r.id}`}
                        className="flex items-center justify-between py-3 px-3 rounded-xl hover:bg-gray-50 transition"
                      >
                        <div>
                          <p className="text-sm font-medium text-charcoal">{r.runnerName}</p>
                          <p className="text-xs text-gray-400">{r.location} &middot; {r.date}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-teal tabular-nums">
                            {Math.floor(r.finishTimeSecs / 60)}:{String(r.finishTimeSecs % 60).padStart(2, "0")}
                          </p>
                          {r.ageGradedPct != null && (
                            <p className="text-xs text-gray-400">{r.ageGradedPct.toFixed(1)}% AG</p>
                          )}
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

