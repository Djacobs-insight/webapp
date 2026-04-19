

"use client";
import Link from "next/link";
import { BackChevron } from "@/components/ui/back-chevron";
import { AuthButton } from "@/components/ui/auth-button";

export default function ProfilePage() {
  return (
    <div className="flex flex-col flex-1">
      <BackChevron />
      <main className="flex flex-col flex-1 w-full max-w-xl mx-auto px-4 py-6 gap-6">
        <h1 className="text-2xl font-bold text-charcoal">Profile</h1>

        <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-5 flex flex-col gap-4">
          <AuthButton />
        </div>

        <nav className="flex flex-col gap-2">
          <Link
            href="/profile/history"
            className="flex items-center gap-3 rounded-2xl bg-white border border-gray-100 shadow-sm px-5 py-4 text-charcoal font-medium hover:bg-gray-50 transition"
          >
            <span className="text-xl">📋</span>
            My parkrun history
          </Link>
          <Link
            href="/profile/trends"
            className="flex items-center gap-3 rounded-2xl bg-white border border-gray-100 shadow-sm px-5 py-4 text-charcoal font-medium hover:bg-gray-50 transition"
          >
            <span className="text-xl">📈</span>
            Performance trends
          </Link>
          <Link
            href="/family"
            className="flex items-center gap-3 rounded-2xl bg-white border border-gray-100 shadow-sm px-5 py-4 text-charcoal font-medium hover:bg-gray-50 transition"
          >
            <span className="text-xl">👨‍👩‍👧‍👦</span>
            Family group
          </Link>
          <Link
            href="/profile/settings"
            className="flex items-center gap-3 rounded-2xl bg-white border border-gray-100 shadow-sm px-5 py-4 text-charcoal font-medium hover:bg-gray-50 transition"
          >
            <span className="text-xl">🔔</span>
            Notification preferences
          </Link>
        </nav>

        <p className="text-sm text-gray-400 text-center">Saturday Morning · iteration1</p>
      </main>
    </div>
  );
}
