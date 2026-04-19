"use client";

import { useEffect, useRef, useState } from "react";
import { BackChevron } from "@/components/ui/back-chevron";
import { useAuth } from "@/lib/auth/useAuth";
import { getTrendData } from "@/lib/actions/results";
import { EmptyState } from "@/components/ui/empty-state";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceDot,
} from "recharts";

type TrendPoint = Awaited<ReturnType<typeof getTrendData>>["points"][number];
type Stats = Awaited<ReturnType<typeof getTrendData>>["stats"];

type ChartView = "ag" | "time";

function formatTime(secs: number) {
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
}

export default function TrendsPage() {
  const { account, loading } = useAuth();
  const [points, setPoints] = useState<TrendPoint[]>([]);
  const [stats, setStats] = useState<Stats>(null);
  const [fetched, setFetched] = useState(false);
  const [view, setView] = useState<ChartView>("ag");
  const [reducedMotion, setReducedMotion] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });
  const fetchingRef = useRef(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    if (!account || fetchingRef.current) return;
    fetchingRef.current = true;
    getTrendData().then((data) => {
      setPoints(data.points);
      setStats(data.stats);
      setFetched(true);
      fetchingRef.current = false;
    });
  }, [account]);

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
            title="Sign in to view trends"
            description="Your performance trends will appear here."
            icon={<span>📈</span>}
          />
        </main>
      </div>
    );
  }

  const hasEnoughData = points.length >= 3;

  return (
    <div className="flex flex-col flex-1">
      <BackChevron href="/profile" />
      <main className="flex flex-col flex-1 w-full max-w-xl mx-auto px-4 py-6 gap-6">
        <h1 className="text-2xl font-bold text-charcoal">Trends</h1>

        {!hasEnoughData ? (
          <EmptyState
            title={points.length === 0 ? "No results yet" : "Keep going!"}
            description={
              points.length === 0
                ? "Record your first parkrun result to get started."
                : `You have ${points.length} result${points.length > 1 ? "s" : ""}. Record at least 3 to see trends!`
            }
            icon={<span>📈</span>}
          />
        ) : (
          <>
            {/* View toggle */}
            <div className="flex rounded-xl bg-gray-100 p-1">
              <button
                onClick={() => setView("ag")}
                className={`flex-1 text-sm font-medium py-2 rounded-lg transition ${
                  view === "ag" ? "bg-white text-charcoal shadow-sm" : "text-gray-400 hover:text-charcoal"
                }`}
              >
                Age-Graded %
              </button>
              <button
                onClick={() => setView("time")}
                className={`flex-1 text-sm font-medium py-2 rounded-lg transition ${
                  view === "time" ? "bg-white text-charcoal shadow-sm" : "text-gray-400 hover:text-charcoal"
                }`}
              >
                Finish Time
              </button>
            </div>

            {/* Chart */}
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                {view === "ag" ? (
                  <AgChart points={points} reducedMotion={reducedMotion} />
                ) : (
                  <TimeChart points={points} reducedMotion={reducedMotion} />
                )}
              </ResponsiveContainer>
            </div>

            {/* Stats summary */}
            {stats && (
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
                {stats.improvementPct != null && (
                  <div className="col-span-2">
                    <StatCard
                      label="Improvement (first → last)"
                      value={`${stats.improvementPct > 0 ? "+" : ""}${stats.improvementPct.toFixed(1)}%`}
                      highlight={stats.improvementPct > 0}
                    />
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function AgChart({ points, reducedMotion }: { points: TrendPoint[]; reducedMotion: boolean }) {
  const agPoints = points.filter((p) => p.ageGradedPct != null);
  const pbPoints = agPoints.filter((p) => p.isPB);

  return (
    <LineChart data={agPoints} margin={{ top: 8, right: 8, bottom: 4, left: -12 }}>
      <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
      <XAxis
        dataKey="date"
        tick={{ fontSize: 11, fill: "#9ca3af" }}
        tickLine={false}
        axisLine={{ stroke: "#e5e5e5" }}
      />
      <YAxis
        tick={{ fontSize: 11, fill: "#9ca3af" }}
        tickLine={false}
        axisLine={false}
        domain={["dataMin - 2", "dataMax + 2"]}
        tickFormatter={(v: number) => `${v}%`}
      />
      <Tooltip
        formatter={(value) => [`${Number(value).toFixed(1)}%`, "AG%"]}
        labelStyle={{ fontSize: 12, color: "#6b7280" }}
        contentStyle={{ borderRadius: 12, border: "1px solid #e5e5e5", fontSize: 13 }}
      />
      <Line
        type="monotone"
        dataKey="ageGradedPct"
        stroke="#2BA5A5"
        strokeWidth={2}
        dot={{ r: 3, fill: "#2BA5A5" }}
        activeDot={{ r: 5 }}
        isAnimationActive={!reducedMotion}
      />
      {pbPoints.map((pb) => (
        <ReferenceDot
          key={pb.id}
          x={pb.date}
          y={pb.ageGradedPct!}
          r={6}
          fill="#f59e0b"
          stroke="#d97706"
          strokeWidth={2}
        />
      ))}
    </LineChart>
  );
}

function TimeChart({ points, reducedMotion }: { points: TrendPoint[]; reducedMotion: boolean }) {
  const pbPoints = points.filter((p) => p.isPB);

  return (
    <LineChart data={points} margin={{ top: 8, right: 8, bottom: 4, left: -4 }}>
      <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
      <XAxis
        dataKey="date"
        tick={{ fontSize: 11, fill: "#9ca3af" }}
        tickLine={false}
        axisLine={{ stroke: "#e5e5e5" }}
      />
      <YAxis
        tick={{ fontSize: 11, fill: "#9ca3af" }}
        tickLine={false}
        axisLine={false}
        reversed
        domain={["dataMin - 30", "dataMax + 30"]}
        tickFormatter={(v: number) => formatTime(v)}
      />
      <Tooltip
        formatter={(value) => [formatTime(Number(value)), "Time"]}
        labelStyle={{ fontSize: 12, color: "#6b7280" }}
        contentStyle={{ borderRadius: 12, border: "1px solid #e5e5e5", fontSize: 13 }}
      />
      <Line
        type="monotone"
        dataKey="finishTimeSecs"
        stroke="#E8654A"
        strokeWidth={2}
        dot={{ r: 3, fill: "#E8654A" }}
        activeDot={{ r: 5 }}
        isAnimationActive={!reducedMotion}
      />
      {pbPoints.map((pb) => (
        <ReferenceDot
          key={pb.id}
          x={pb.date}
          y={pb.finishTimeSecs}
          r={6}
          fill="#f59e0b"
          stroke="#d97706"
          strokeWidth={2}
        />
      ))}
    </LineChart>
  );
}

function StatCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-xl bg-white border border-gray-100 shadow-sm p-3 text-center">
      <p className={`text-xl font-bold tabular-nums ${highlight ? "text-green-600" : "text-teal"}`}>{value}</p>
      <p className="text-xs text-gray-400 mt-0.5">{label}</p>
    </div>
  );
}
