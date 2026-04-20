"use client";

import { useState, useEffect } from "react";
import { toggleReaction, getReactions } from "@/lib/actions/reactions";
import { ALLOWED_EMOJIS, type ReactionGroup } from "@/lib/reactions-constants";
import { useAuth } from "@/lib/auth/useAuth";

export function ReactionBar({ resultId }: { resultId: string }) {
  const { account } = useAuth();
  const [groups, setGroups] = useState<ReactionGroup[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getReactions(resultId).then((data) => {
      setGroups(data);
      setLoading(false);
    });
  }, [resultId]);

  async function handleToggle(emoji: string) {
    if (!account) return;

    // Optimistic update
    setGroups((prev) => {
      const existing = prev.find((g) => g.emoji === emoji);
      if (existing) {
        if (existing.reacted) {
          // Removing
          const newCount = existing.count - 1;
          return newCount <= 0
            ? prev.filter((g) => g.emoji !== emoji)
            : prev.map((g) => g.emoji === emoji ? { ...g, count: newCount, reacted: false } : g);
        } else {
          // Adding
          return prev.map((g) => g.emoji === emoji ? { ...g, count: g.count + 1, reacted: true } : g);
        }
      } else {
        return [...prev, { emoji, count: 1, reacted: true }];
      }
    });
    setPickerOpen(false);

    const result = await toggleReaction({ resultId, emoji });
    if (!result.success) {
      // Revert on error
      const refreshed = await getReactions(resultId);
      setGroups(refreshed);
    }
  }

  if (loading) return null;

  return (
    <section className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {groups.map((g) => (
          <button
            key={g.emoji}
            onClick={() => handleToggle(g.emoji)}
            className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm border transition ${
              g.reacted
                ? "border-teal bg-teal/10 text-teal font-semibold"
                : "border-gray-200 bg-white text-charcoal hover:border-gray-300"
            }`}
            aria-label={`${g.emoji} ${g.count} reaction${g.count !== 1 ? "s" : ""}${g.reacted ? ", you reacted" : ""}`}
          >
            <span>{g.emoji}</span>
            <span className="tabular-nums">{g.count}</span>
          </button>
        ))}

        {/* Add reaction button */}
        {account && (
          <div className="relative">
            <button
              onClick={() => setPickerOpen((prev) => !prev)}
              className="inline-flex items-center justify-center w-9 h-9 rounded-full border border-gray-200 bg-white text-gray-400 hover:border-gray-300 hover:text-gray-500 transition"
              aria-label="Add reaction"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                <line x1="9" y1="9" x2="9.01" y2="9" />
                <line x1="15" y1="9" x2="15.01" y2="9" />
              </svg>
            </button>

            {/* Emoji picker */}
            {pickerOpen && (
              <>
                {/* Backdrop */}
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setPickerOpen(false)}
                />
                <div className="absolute bottom-full mb-2 right-0 z-50 bg-white rounded-xl shadow-lg border border-gray-100 p-2 flex gap-1">
                  {ALLOWED_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => handleToggle(emoji)}
                      className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-gray-100 text-xl transition"
                      aria-label={`React with ${emoji}`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
