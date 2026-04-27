"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getUserBadges, getBadgeFamilyHolders, type UserBadgeDisplay } from "@/lib/actions/badges";

function timeAgo(iso: string): string {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export function BadgeGrid({ userId }: { userId?: string }) {
  const [badges, setBadges] = useState<UserBadgeDisplay[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBadge, setSelectedBadge] = useState<UserBadgeDisplay | null>(null);
  const [holders, setHolders] = useState<{ userId: string; name: string; awardedAt: string }[]>([]);
  const [holdersLoading, setHoldersLoading] = useState(false);

  useEffect(() => {
    getUserBadges(userId)
      .then((data) => {
        setBadges(data);
      })
      .catch((err) => {
        console.error("Failed to load badges:", err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [userId]);

  const earned = badges.filter((b) => b.earned);
  const unearned = badges.filter((b) => !b.earned);

  async function openDetail(badge: UserBadgeDisplay) {
    setSelectedBadge(badge);
    if (badge.earned) {
      setHoldersLoading(true);
      try {
        const h = await getBadgeFamilyHolders(badge.key);
        setHolders(h);
      } catch (err) {
        console.error("Failed to load badge holders:", err);
        setHolders([]);
      } finally {
        setHoldersLoading(false);
      }
    } else {
      setHolders([]);
    }
  }

  const [reducedMotion] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-6 h-6 border-2 border-teal border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (badges.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        <p className="text-3xl mb-2">🏅</p>
        <p className="text-sm">No badges available yet</p>
      </div>
    );
  }

  return (
    <>
      {/* Earned badges */}
      {earned.length > 0 && (
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Earned ({earned.length})
          </h3>
          <div className="grid grid-cols-4 gap-3">
            {earned.map((badge) => (
              <button
                key={badge.key}
                onClick={() => openDetail(badge)}
                className="flex flex-col items-center gap-1 p-3 rounded-xl bg-white border border-gray-100 shadow-sm hover:shadow-md transition"
              >
                <span className="text-3xl">{badge.icon}</span>
                <span className="text-[11px] font-medium text-charcoal text-center leading-tight">
                  {badge.name}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Unearned badges */}
      {unearned.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Locked ({unearned.length})
          </h3>
          <div className="grid grid-cols-4 gap-3">
            {unearned.map((badge) => (
              <button
                key={badge.key}
                onClick={() => openDetail(badge)}
                className="flex flex-col items-center gap-1 p-3 rounded-xl bg-gray-50 border border-gray-100 opacity-50 hover:opacity-75 transition"
              >
                <span className="text-3xl grayscale">{badge.icon}</span>
                <span className="text-[11px] font-medium text-gray-400 text-center leading-tight">
                  {badge.name}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Badge detail bottom sheet */}
      <AnimatePresence>
        {selectedBadge && (
          <motion.div
            className="fixed inset-0 z-50 flex items-end justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/30"
              onClick={() => setSelectedBadge(null)}
            />

            {/* Sheet */}
            <motion.div
              className="relative w-full max-w-lg bg-white rounded-t-2xl shadow-xl p-6 pb-8"
              initial={reducedMotion ? { opacity: 0 } : { y: "100%" }}
              animate={reducedMotion ? { opacity: 1 } : { y: 0 }}
              exit={reducedMotion ? { opacity: 0 } : { y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
            >
              {/* Handle */}
              <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />

              <div className="flex items-center gap-4 mb-4">
                <span className={`text-5xl ${selectedBadge.earned ? "" : "grayscale opacity-50"}`}>
                  {selectedBadge.icon}
                </span>
                <div>
                  <h3 className="text-lg font-bold text-charcoal">{selectedBadge.name}</h3>
                  <p className="text-sm text-gray-500">{selectedBadge.description}</p>
                </div>
              </div>

              {selectedBadge.earned && selectedBadge.awardedAt && (
                <p className="text-sm text-teal font-medium mb-4">
                  Earned on {timeAgo(selectedBadge.awardedAt)}
                </p>
              )}

              {!selectedBadge.earned && selectedBadge.progressHint && (
                <p className="text-sm text-gray-500 bg-gray-50 rounded-xl px-4 py-3 mb-4">
                  💡 {selectedBadge.progressHint}
                </p>
              )}

              {/* Family holders */}
              {selectedBadge.earned && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Family members with this badge
                  </h4>
                  {holdersLoading ? (
                    <div className="flex items-center justify-center py-4">
                      <div className="w-5 h-5 border-2 border-teal border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : holders.length <= 1 ? (
                    <p className="text-sm text-gray-400 py-2">
                      You&apos;re the first! Challenge your family to earn this badge too.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {holders.map((h) => (
                        <li key={h.userId} className="flex items-center justify-between text-sm">
                          <span className="text-charcoal font-medium">{h.name}</span>
                          <span className="text-gray-400">{timeAgo(h.awardedAt)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              <button
                onClick={() => setSelectedBadge(null)}
                className="mt-6 w-full py-3 rounded-xl bg-gray-100 text-charcoal font-medium hover:bg-gray-200 transition"
              >
                Close
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
