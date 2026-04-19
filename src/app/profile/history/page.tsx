"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { BackChevron } from "@/components/ui/back-chevron";
import { useAuth } from "@/lib/auth/useAuth";
import { getPersonalHistory } from "@/lib/actions/results";
import { EmptyState } from "@/components/ui/empty-state";

type HistoryItem = Awaited<ReturnType<typeof getPersonalHistory>>["items"][number];
type Stats = Awaited<ReturnType<typeof getPersonalHistory>>["stats"];

function formatTime(secs: number) {
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
}

export default function HistoryPage() {
  const { account, loading } = useAuth();
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [stats, setStats] = useState<Stats>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [fetched, setFetched] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const fetchingRef = useRef(false);

  useEffect(() => {
    if (!account || fetchingRef.current) return;
    fetchingRef.current = true;
    getPersonalHistory().then((data) => {
      setItems(data.items);
      setCursor(data.nextCursor);
      setStats(data.stats);
      setFetched(true);
      fetchingRef.current = false;
    });
  }, [account]);

  const loadMore = useCallback(() => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    getPersonalHistory(cursor).then((data) => {
      setItems((prev) => [...prev, ...data.items]);
      setCursor(data.nextCursor);
      setLoadingMore(false);
    });
  }, [cursor, loadingMore]);

  if (loading || (account && !fetched)) {
    return (
      <div className="flex flex-1 items-center justify-center min-h-screen">
        <div className="w-10 h-10 rounded-full border-4 border-coral border-t-transparent animate-spin" aria-label="Loading" />
      </div>
    );
  }

  if (!account) {
    return (
      <div className="flex flex-col flex-1">
        <BackChevron href="/profile" />
        <main className="flex flex-col flex-1 items-center justify-center px-6">
          <EmptyState
            title="Sign in to view history"
            description="Your personal parkrun history will appear here."
            icon={<span>📋</span>}
          />
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1">
      <BackChevron href="/profile" />
      <main className="flex flex-col flex-1 w-full max-w-xl mx-auto px-4 py-6 gap-6">
        <h1 className="text-2xl font-bold text-charcoal">My History</h1>

        {/* Stats summary */}
        {stats && stats.totalRuns > 0 && (
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Total Runs" value={String(stats.totalRuns)} />
            <StatCard
              label="Best Time"
              value={stats.bestTimeSecs != null ? formatTime(stats.bestTimeSecs) : "—"}
            />
            <StatCard
              label="Best AG%"
              value={stats.bestAgeGradedPct != null ? `${stats.bestAgeGradedPct.toFixed(1)}%` : "—"}
            />
            <StatCard
              label="Avg AG%"
              value={stats.avgAgeGradedPct != null ? `${stats.avgAgeGradedPct.toFixed(1)}%` : "—"}
            />
          </div>
        )}

        {/* Timeline */}
        {items.length === 0 ? (
          <EmptyState
            title="No results yet"
            description="Enter your first parkrun result to start building your history!"
            icon={<span>🏃</span>}
          />
        ) : (
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />

            <div className="flex flex-col gap-1">
              {items.map((item) => (
                <TimelineEntry key={item.id} item={item} />
              ))}
            </div>

            {/* Load more */}
            {cursor && (
              <div className="flex justify-center mt-4">
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="px-5 py-2 text-sm font-medium text-teal bg-teal/10 rounded-full hover:bg-teal/20 transition disabled:opacity-50"
                >
                  {loadingMore ? "Loading…" : "Load more"}
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function TimelineEntry({ item }: { item: HistoryItem }) {
  return (
    <div className="relative flex items-start gap-3 pl-8 py-3">
      {/* Dot */}
      <div
        className={`absolute left-2.5 top-5 w-3 h-3 rounded-full border-2 ${
          item.isPB
            ? "bg-amber-400 border-amber-500"
            : "bg-white border-gray-300"
        }`}
      />
      {/* Card */}
      <div
        className={`flex-1 rounded-xl p-3 transition ${
          item.isPB
            ? "bg-amber-50 ring-1 ring-amber-200"
            : "bg-white hover:bg-gray-50"
        }`}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-charcoal">
              {item.location}
              {item.isPB && (
                <span className="ml-1.5 inline-flex items-center text-xs font-semibold text-amber-600">
                  ⭐ PB
                </span>
              )}
            </p>
            <p className="text-xs text-gray-400">{item.date}</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-teal tabular-nums">
              {formatTime(item.finishTimeSecs)}
            </p>
            {item.ageGradedPct != null && (
              <p className="text-xs text-gray-400">{item.ageGradedPct.toFixed(1)}% AG</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white border border-gray-100 shadow-sm p-3 text-center">
      <p className="text-xl font-bold text-teal tabular-nums">{value}</p>
      <p className="text-xs text-gray-400 mt-0.5">{label}</p>
    </div>
  );
}
