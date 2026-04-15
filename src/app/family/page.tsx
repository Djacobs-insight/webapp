"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/useAuth";
import { getFamilyForUser, createInvite, removeMember } from "@/lib/actions/family";
import { Button } from "@/components/ui/button";
import Link from "next/link";

type Member = {
  id: string;
  role: string;
  joinedAt: string;
  user: { id: string; name: string | null; email: string; parkrunHomeEvent: string | null };
};

type FamilyData = {
  id: string;
  role: string;
  family: { id: string; name: string; members: Member[] };
};

export default function FamilyPage() {
  const { account, loading: authLoading } = useAuth();
  const router = useRouter();
  const [familyData, setFamilyData] = useState<FamilyData | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const loadFamily = useCallback(async () => {
    if (!account) return;
    setPageLoading(true);
    const data = await getFamilyForUser(account.localAccountId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setFamilyData(data as any);
    setPageLoading(false);
  }, [account]);

  useEffect(() => {
    if (!authLoading && !account) {
      router.push("/");
      return;
    }
    if (!authLoading && account) {
      loadFamily();
    }
  }, [authLoading, account, router, loadFamily]);

  async function handleGenerateInvite() {
    if (!account || !familyData) return;
    setInviteLoading(true);
    setInviteError(null);
    const appUrl = window.location.origin;
    const result = await createInvite({
      familyId: familyData.family.id,
      invitedById: account.localAccountId,
      appUrl,
    });
    setInviteLoading(false);
    if (!result.success) {
      setInviteError(result.error);
      return;
    }
    setInviteUrl(result.inviteUrl);
  }

  async function handleCopy() {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  async function handleRemove(familyMemberId: string) {
    if (!account) return;
    setRemovingId(familyMemberId);
    const result = await removeMember({
      familyMemberId,
      requestingUserId: account.localAccountId,
    });
    setRemovingId(null);
    if (result.success) {
      await loadFamily();
    }
  }

  if (authLoading || pageLoading) {
    return (
      <main className="min-h-screen bg-warm-white flex items-center justify-center">
        <p className="text-charcoal/50 text-sm">Loading…</p>
      </main>
    );
  }

  // No family yet — prompt to create
  if (!familyData) {
    return (
      <main className="min-h-screen bg-warm-white flex flex-col items-center justify-center px-6 pb-24">
        <div className="w-full max-w-sm text-center">
          <div className="text-5xl mb-4">👨‍👩‍👧‍👦</div>
          <h1 className="text-2xl font-bold text-charcoal mb-2">No family group yet</h1>
          <p className="text-charcoal/70 text-sm mb-8">
            Create a family group to track everyone's parkrun progress together.
          </p>
          <Link href="/family/new">
            <Button className="w-full bg-coral hover:bg-coral/90 text-white rounded-full py-3 font-semibold text-base">
              Create a family
            </Button>
          </Link>
        </div>
      </main>
    );
  }

  const { family, role: myRole } = familyData;
  const isAdmin = myRole === "admin";
  const memberCount = family.members.length;

  return (
    <main className="min-h-screen bg-warm-white pb-24">
      {/* Header */}
      <header className="bg-white border-b border-charcoal/10 px-6 py-5">
        <Link href="/" className="text-charcoal/60 text-sm hover:text-charcoal">
          ← Back
        </Link>
        <h1 className="text-xl font-bold text-charcoal mt-2">{family.name}</h1>
        <p className="text-charcoal/60 text-xs mt-0.5">{memberCount} member{memberCount !== 1 ? "s" : ""}</p>
      </header>

      <div className="px-6 py-6 max-w-lg mx-auto space-y-6">
        {/* Members list */}
        <section>
          <h2 className="text-sm font-semibold text-charcoal/60 uppercase tracking-wide mb-3">Members</h2>
          <ul className="bg-white rounded-2xl overflow-hidden divide-y divide-charcoal/10 shadow-sm">
            {family.members.map((m) => {
              const isSelf = m.user.id === account?.localAccountId;
              const canRemove = isAdmin || isSelf;
              return (
                <li key={m.id} className="flex items-center gap-3 px-4 py-3">
                  {/* Avatar placeholder */}
                  <div className="h-10 w-10 rounded-full bg-teal/20 flex items-center justify-center text-teal font-bold text-sm shrink-0">
                    {(m.user.name ?? m.user.email)[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-charcoal font-medium text-sm truncate">
                      {m.user.name ?? m.user.email}
                      {isSelf && <span className="text-charcoal/40 font-normal ml-1">(you)</span>}
                    </p>
                    {m.user.parkrunHomeEvent && (
                      <p className="text-charcoal/50 text-xs truncate">{m.user.parkrunHomeEvent}</p>
                    )}
                  </div>
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      m.role === "admin"
                        ? "bg-gold/20 text-gold"
                        : "bg-charcoal/10 text-charcoal/60"
                    }`}
                  >
                    {m.role}
                  </span>
                  {canRemove && !isSelf && (
                    <button
                      type="button"
                      onClick={() => handleRemove(m.id)}
                      disabled={removingId === m.id}
                      className="text-xs text-red-400 hover:text-red-600 disabled:opacity-40 ml-2"
                      aria-label={`Remove ${m.user.name ?? m.user.email}`}
                    >
                      {removingId === m.id ? "…" : "Remove"}
                    </button>
                  )}
                  {isSelf && !isAdmin && (
                    <button
                      type="button"
                      onClick={() => handleRemove(m.id)}
                      disabled={removingId === m.id}
                      className="text-xs text-red-400 hover:text-red-600 disabled:opacity-40 ml-2"
                      aria-label="Leave family"
                    >
                      {removingId === m.id ? "…" : "Leave"}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        {/* Invite section */}
        {isAdmin && (
          <section className="bg-white rounded-2xl p-5 shadow-sm space-y-3">
            <h2 className="text-sm font-semibold text-charcoal">Invite a member</h2>
            <p className="text-charcoal/60 text-xs">
              Generate a link to send to someone. Links expire after 7 days and can only be used once.
            </p>

            {inviteError && (
              <div className="bg-red-50 rounded-xl px-4 py-3">
                <p className="text-sm text-red-600">{inviteError}</p>
                {inviteError.includes("limit") && (
                  <p className="text-xs text-charcoal/60 mt-1">
                    Upgrade coming soon — stay tuned!
                  </p>
                )}
              </div>
            )}

            {inviteUrl ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 bg-charcoal/5 rounded-xl px-4 py-3">
                  <p className="text-xs text-charcoal/70 truncate flex-1 font-mono">{inviteUrl}</p>
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="text-xs font-semibold text-teal hover:text-teal/80 shrink-0"
                  >
                    {copied ? "Copied!" : "Copy"}
                  </button>
                </div>
                <Button
                  type="button"
                  onClick={() => { setInviteUrl(null); setInviteError(null); }}
                  className="w-full bg-charcoal/10 text-charcoal hover:bg-charcoal/20 rounded-full text-sm py-2"
                >
                  Generate another
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                onClick={handleGenerateInvite}
                disabled={inviteLoading}
                className="w-full bg-teal hover:bg-teal/90 text-white rounded-full py-3 font-semibold text-sm disabled:opacity-50"
              >
                {inviteLoading ? "Generating…" : "Generate invite link"}
              </Button>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
