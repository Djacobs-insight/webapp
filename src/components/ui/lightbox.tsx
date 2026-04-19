"use client";

import { useCallback, useEffect } from "react";
import Image from "next/image";

interface LightboxProps {
  src: string;
  alt?: string;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  footer?: React.ReactNode;
}

export function Lightbox({ src, alt, onClose, onPrev, onNext, footer }: LightboxProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && onPrev) onPrev();
      if (e.key === "ArrowRight" && onNext) onNext();
    },
    [onClose, onPrev, onNext],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [handleKeyDown]);

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col bg-black/90"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={alt ?? "Photo lightbox"}
    >
      {/* Close button */}
      <button
        className="absolute top-4 right-4 z-[61] w-10 h-10 rounded-full bg-white/20 text-white flex items-center justify-center text-2xl hover:bg-white/30 transition"
        onClick={onClose}
        aria-label="Close"
      >
        ×
      </button>

      {/* Prev */}
      {onPrev && (
        <button
          className="absolute left-3 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white/20 text-white flex items-center justify-center text-xl hover:bg-white/30 transition"
          onClick={(e) => {
            e.stopPropagation();
            onPrev();
          }}
          aria-label="Previous photo"
        >
          ‹
        </button>
      )}

      {/* Next */}
      {onNext && (
        <button
          className="absolute right-3 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white/20 text-white flex items-center justify-center text-xl hover:bg-white/30 transition"
          onClick={(e) => {
            e.stopPropagation();
            onNext();
          }}
          aria-label="Next photo"
        >
          ›
        </button>
      )}

      {/* Image area — grows to fill remaining space */}
      <div className="flex-1 min-h-0 relative mx-4 my-4" onClick={(e) => e.stopPropagation()}>
        <Image
          src={src}
          alt={alt ?? "Photo"}
          fill
          className="object-contain"
          unoptimized
          priority
        />
      </div>

      {/* Footer — always visible, never overlapped */}
      {footer && (
        <div
          className="shrink-0 bg-black/70 p-4"
          onClick={(e) => e.stopPropagation()}
        >
          {footer}
        </div>
      )}
    </div>
  );
}
