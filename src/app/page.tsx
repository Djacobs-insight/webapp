"use client";
import { useAuth } from "@/lib/auth/useAuth";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export default function DashboardPage() {
  const { account, loading, login } = useAuth();

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center min-h-screen">
        <div className="w-10 h-10 rounded-full border-4 border-coral border-t-transparent animate-spin" aria-label="Loading" />
      </div>
    );
  }

  if (!account) {
    return <LandingScreen onSignIn={login} />;
  }

  return <AuthenticatedDashboard name={account.name ?? account.username} />;
}

function LandingScreen({ onSignIn }: { onSignIn: () => void }) {
  return (
    <main className="flex flex-col flex-1 items-center justify-center min-h-screen px-6 gap-8 text-center">
      {/* Logo / wordmark */}
      <div className="flex flex-col items-center gap-3">
        <span className="text-5xl" role="img" aria-label="Running shoe">👟</span>
        <h1 className="text-3xl font-bold text-charcoal">Saturday Morning</h1>
        <p className="text-lg text-gray-500 max-w-xs">
          Family parkrun, together — wherever you are in the world.
        </p>
      </div>

      {/* Value props */}
      <ul className="flex flex-col gap-2 text-left text-base text-charcoal w-full max-w-xs">
        {[
          "🏃 Log your parkrun time in under 15 seconds",
          "🏆 Compete fairly with age-graded scores",
          "🎉 Celebrate every result with your family",
          "📍 Works across time zones — all day Saturday",
        ].map((item) => (
          <li key={item} className="flex gap-2">{item}</li>
        ))}
      </ul>

      <Button variant="primary" onClick={onSignIn} className="w-full max-w-xs">
        Get started — it&apos;s free
      </Button>

      <p className="text-sm text-gray-400">
        Already have an account?{" "}
        <button onClick={onSignIn} className="text-teal underline">Sign in</button>
      </p>
    </main>
  );
}

function AuthenticatedDashboard({ name }: { name: string }) {
  const firstName = name.split(" ")[0];

  return (
    <main className="flex flex-col flex-1 w-full max-w-xl mx-auto px-4 py-6 gap-6">
      {/* Welcome header */}
      <section>
        <p className="text-sm text-gray-500 uppercase tracking-wide font-medium">Saturday Morning</p>
        <h1 className="text-2xl font-bold text-charcoal mt-1">
          Welcome back, {firstName}! 👋
        </h1>
      </section>

      {/* Quick action — enter result */}
      <section>
        <Button variant="primary" className="w-full text-xl py-5">
          🏃 Enter today&apos;s result
        </Button>
      </section>

      {/* Family leaderboard card */}
      <section className="rounded-2xl border border-gray-100 bg-white shadow-sm p-4">
        <h2 className="text-lg font-bold text-charcoal mb-3">Family Leaderboard</h2>
        <EmptyState
          title="Saturday's coming!"
          description="Invite your family to start competing. Who'll be first to post?"
          icon={<span>🏅</span>}
          action={
            <Button variant="secondary" className="mt-2">
              Invite family members
            </Button>
          }
        />
      </section>

      {/* Summary cards row */}
      <section className="grid grid-cols-2 gap-3">
        <SummaryCard label="Your streak" value="—" emoji="🔥" />
        <SummaryCard label="Personal best" value="—" emoji="⚡" />
      </section>
    </main>
  );
}

function SummaryCard({ label, value, emoji }: { label: string; value: string; emoji: string }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-4 flex flex-col gap-1">
      <span className="text-2xl">{emoji}</span>
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-xl font-bold text-charcoal">{value}</p>
    </div>
  );
}
