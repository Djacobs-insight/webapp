"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { MilestoneInfo } from "@/lib/actions/results";

const CONFETTI_COLORS = ["#E8654A", "#2BA5A5", "#f59e0b", "#8b5cf6", "#ec4899", "#10b981"];
const CONFETTI_COUNT = 40;
const DISPLAY_MS = 5000;

interface ConfettiPiece {
  id: number;
  x: number;
  delay: number;
  color: string;
  rotation: number;
  size: number;
  duration: number;
}

function generateConfetti(): ConfettiPiece[] {
  return Array.from({ length: CONFETTI_COUNT }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    delay: Math.random() * 0.8,
    color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
    rotation: Math.random() * 360,
    size: 6 + Math.random() * 6,
    duration: 2.5 + Math.random(),
  }));
}

export function CelebrationOverlay({
  milestones,
  onDismiss,
}: {
  milestones: MilestoneInfo[];
  onDismiss: () => void;
}) {
  const [visible, setVisible] = useState(true);
  const [confetti] = useState(generateConfetti);
  const [reducedMotion] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });

  const dismiss = useCallback(() => {
    setVisible(false);
    onDismiss();
  }, [onDismiss]);

  useEffect(() => {
    const timer = setTimeout(dismiss, DISPLAY_MS);
    return () => clearTimeout(timer);
  }, [dismiss]);

  if (milestones.length === 0) return null;

  // Reduced motion: static banner only
  if (reducedMotion) {
    return (
      <AnimatePresence>
        {visible && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
            onClick={dismiss}
          >
            <div className="bg-white rounded-2xl shadow-xl mx-6 p-6 max-w-sm w-full text-center">
              <p className="text-3xl mb-3">🎉</p>
              {milestones.map((m, i) => (
                <p key={i} className="text-lg font-bold text-charcoal">
                  {m.label}
                </p>
              ))}
              <button
                onClick={dismiss}
                className="mt-4 text-sm text-gray-400 hover:text-charcoal transition"
              >
                Tap to dismiss
              </button>
            </div>
          </div>
        )}
      </AnimatePresence>
    );
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          onClick={dismiss}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/30" />

          {/* Confetti */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {confetti.map((piece) => (
              <motion.div
                key={piece.id}
                className="absolute"
                style={{
                  left: `${piece.x}%`,
                  top: -20,
                  width: piece.size,
                  height: piece.size * 1.4,
                  backgroundColor: piece.color,
                  borderRadius: 2,
                }}
                initial={{ y: -20, rotate: 0, opacity: 1 }}
                animate={{
                  y: typeof window !== "undefined" ? window.innerHeight + 40 : 800,
                  rotate: piece.rotation + 720,
                  opacity: [1, 1, 0.8, 0],
                }}
                transition={{
                  duration: piece.duration,
                  delay: piece.delay,
                  ease: "easeIn",
                }}
              />
            ))}
          </div>

          {/* Banner */}
          <motion.div
            className="relative bg-white rounded-2xl shadow-xl mx-6 p-6 max-w-sm w-full text-center"
            initial={{ scale: 0.5, y: 40 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: "spring", damping: 15, stiffness: 200, delay: 0.2 }}
          >
            <motion.p
              className="text-5xl mb-3"
              initial={{ scale: 0 }}
              animate={{ scale: [0, 1.3, 1] }}
              transition={{ duration: 0.5, delay: 0.4 }}
            >
              🎉
            </motion.p>
            {milestones.map((m, i) => (
              <motion.p
                key={i}
                className="text-lg font-bold text-charcoal"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 + i * 0.15 }}
              >
                {m.label}
              </motion.p>
            ))}
            <motion.button
              onClick={dismiss}
              className="mt-4 text-sm text-gray-400 hover:text-charcoal transition"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
            >
              Tap to dismiss
            </motion.button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
