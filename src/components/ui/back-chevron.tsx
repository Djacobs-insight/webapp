"use client";
import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export const BackChevron: React.FC<{ href?: string }> = ({ href }) => {
  const router = useRouter();

  const handleClick = (e: React.MouseEvent) => {
    if (!href) {
      e.preventDefault();
      router.back();
    }
  };

  return (
    <Link
      href={href ?? "/"}
      onClick={handleClick}
      className="flex items-center text-teal hover:text-coral transition md:hidden px-4 pt-4 pb-1 self-start"
      aria-label="Back"
    >
      <svg width="28" height="28" fill="none" viewBox="0 0 24 24">
        <path d="M15 19l-7-7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      <span className="ml-1 text-base font-medium">Back</span>
    </Link>
  );
};
