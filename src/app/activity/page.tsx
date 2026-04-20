"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getActivityFeed, type ActivityItem } from "@/lib/actions/cheers";
import { useAuth } from "@/lib/auth/useAuth";
import { EmptyState } from "@/components/ui/empty-state";
import { BackChevron } from "@/components/ui/back-chevron";

const POLL_INTERVAL = 30_000;

const TYPE_ICONS: Record<ActivityItem["type"], string> = {
  result: "🏃",
  comment: "💬",
  reaction: "😊",
  cheer: "📣",
  milestone: "🏅",
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function ActivityPage() {
  const { account, loading: authLoading } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    return getActivityFeed().then((data) => {
      setItems(data);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Poll every 30 seconds
  useEffect(() => {
    const id = setInterval(refresh, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [refresh]);

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
        <main className="flex flex-col flex-1 items-center justify-center px-6">
          <p className="text-gray-500">Sign in to view activity.</p>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1">
      <BackChevron />
      <main className="flex flex-col flex-1 w-full max-w-xl mx-auto px-4 py-6 gap-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-charcoal">Activity Feed</h1>
          <button
            onClick={refresh}
            className="text-sm text-teal font-medium hover:underline"
            aria-label="Refresh feed"
          >
            Refresh
          </button>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 rounded-full border-3 border-teal border-t-transparent animate-spin" />
          </div>
        )}

        {!loading && items.length === 0 && (
          <EmptyState
            title="No activity yet"
            description="When your family starts posting results, commenting, and cheering — it'll all show up here."
            icon={<span>📭</span>}
          />
        )}

        {!loading && items.length > 0 && (
          <ul className="flex flex-col gap-2">
            {items.map((item) => (
              <li key={item.id}>
                <button
                  className="w-full text-left rounded-xl bg-white border border-gray-100 shadow-sm p-4 flex items-start gap-3 hover:bg-gray-50 transition"
                  onClick={() => item.resultId && router.push(`/board/${item.resultId}`)}
                  disabled={!item.resultId}
                >
                  <span className="text-2xl shrink-0 mt-0.5">{TYPE_ICONS[item.type]}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-charcoal">
                      <span className="font-semibold">{item.actorName}</span>{" "}
                      {item.action}{" "}
                      <span className="text-gray-500">{item.target}</span>
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">{timeAgo(item.createdAt)}</p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
