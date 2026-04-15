

"use client";
import Link from "next/link";
import { BackChevron } from "@/components/ui/back-chevron";
import { AuthButton } from "@/components/ui/auth-button";
import { Button } from "@/components/ui/button";

export default function ProfilePage() {
  return (
    <div className="flex flex-col flex-1">
      <BackChevron />
      <main className="flex flex-col flex-1 w-full max-w-xl mx-auto px-4 py-6 gap-6">
        <h1 className="text-2xl font-bold text-charcoal">Profile</h1>

        <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-5 flex flex-col gap-4">
          <AuthButton />
        </div>

        <div className="flex flex-col gap-2">
          <Link href="/family">
            <Button variant="secondary" className="w-full justify-start">
              👨‍👩‍👧‍👦 Family group
            </Button>
          </Link>
          <Link href="/profile/settings">
            <Button variant="secondary" className="w-full justify-start">
              🔔 Notification preferences
            </Button>
          </Link>
        </div>

        <p className="text-sm text-gray-400 text-center">Saturday Morning · iteration1</p>
      </main>
    </div>
  );
}
