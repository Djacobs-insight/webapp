"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { toggleCheer, getCheerCount } from "@/lib/actions/cheers";
import { useAuth } from "@/lib/auth/useAuth";

export function CheerButton({ resultId }: { resultId: string }) {
  const { account } = useAuth();
  const [count, setCount] = useState(0);
  const [cheered, setCheered] = useState(false);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    getCheerCount(resultId).then((data) => {
      setCount(data.count);
      setCheered(data.cheered);
    });
  }, [resultId]);

  async function handleCheer() {
    if (!account) return;

    // Optimistic
    const wasCheered = cheered;
    setCheered(!wasCheered);
    setCount((prev) => prev + (wasCheered ? -1 : 1));
    if (!wasCheered) {
      setAnimating(true);
      setTimeout(() => setAnimating(false), 600);
    }

    const result = await toggleCheer(resultId);
    if (!result.success) {
      // Revert
      setCheered(wasCheered);
      setCount((prev) => prev + (wasCheered ? 1 : -1));
    }
  }

  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  return (
    <motion.button
      onClick={handleCheer}
      className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold border transition ${
        cheered
          ? "border-coral bg-coral/10 text-coral"
          : "border-gray-200 bg-white text-charcoal hover:border-gray-300"
      }`}
      animate={
        animating && !prefersReducedMotion
          ? { scale: [1, 1.2, 1] }
          : {}
      }
      transition={{ duration: 0.3 }}
      aria-label={`Cheer${cheered ? "ed" : ""} — ${count} cheer${count !== 1 ? "s" : ""}`}
    >
      <span className="text-lg">📣</span>
      <span>Cheer{cheered ? "ed" : ""}</span>
      {count > 0 && <span className="tabular-nums">{count}</span>}
    </motion.button>
  );
}
