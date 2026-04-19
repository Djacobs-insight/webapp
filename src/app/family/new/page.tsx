"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/useAuth";
import { createFamily } from "@/lib/actions/family";
import { Button } from "@/components/ui/button";

export default function CreateFamilyPage() {
  const { account } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!account) return;
    setError(null);
    setLoading(true);

    const result = await createFamily({ name });

    setLoading(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    router.push("/family");
  }

  return (
    <main className="min-h-screen bg-warm-white flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <button
          type="button"
          onClick={() => router.back()}
          className="mb-6 text-charcoal/60 text-sm flex items-center gap-1 hover:text-charcoal transition-colors"
          aria-label="Go back"
        >
          ← Back
        </button>

        <h1 className="text-2xl font-bold text-charcoal mb-2">Create your family</h1>
        <p className="text-charcoal/70 text-sm mb-8">
          Give your parkrun family a name — this is what members will see when they receive your invite.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="family-name" className="text-sm font-medium text-charcoal">
              Family name
            </label>
            <input
              id="family-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. The Smiths, Team Teal…"
              maxLength={60}
              required
              className="w-full rounded-xl border border-charcoal/20 bg-white px-4 py-3 text-charcoal placeholder:text-charcoal/40 focus:outline-none focus:ring-2 focus:ring-teal"
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-2">
              {error}
            </p>
          )}

          <Button
            type="submit"
            disabled={loading || name.trim().length < 2}
            className="w-full bg-coral hover:bg-coral/90 text-white rounded-full py-3 font-semibold text-base disabled:opacity-50"
          >
            {loading ? "Creating…" : "Create family"}
          </Button>
        </form>
      </div>
    </main>
  );
}
