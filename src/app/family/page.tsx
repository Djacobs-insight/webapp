"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/useAuth";
import { getFamilyForUser, createInvite, removeMember } from "@/lib/actions/family";
import { Button } from "@/components/ui/button";
import { BackChevron } from "@/components/ui/back-chevron";
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
    const data = await getFamilyForUser();
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, account]);

  async function handleGenerateInvite() {
    if (!account || !familyData) return;
    setInviteLoading(true);
    setInviteError(null);
    const appUrl = window.location.origin;
    const result = await createInvite({
      familyId: familyData.family.id,
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
    });
    setRemovingId(null);
    if (result.success) {
      await loadFamily();
    }
  }

  if (authLoading || pageLoading) {
    return (
      <div className="flex flex-1 items-center justify-center min-h-screen">
        <div className="w-10 h-10 rounded-full border-4 border-coral border-t-transparent animate-spin" aria-label="Loading" />
      </div>
    );
  }

  // No family yet — prompt to create
  if (!familyData) {
    return (
      <div className="flex flex-col flex-1">
        <BackChevron />
        <main className="flex flex-col flex-1 items-center justify-center px-6">
          <div className="w-full max-w-sm text-center">
            <div className="text-5xl mb-4">👨‍👩‍👧‍👦</div>
            <h1 className="text-2xl font-bold text-charcoal mb-2">No family group yet</h1>
            <p className="text-charcoal/70 text-sm mb-8">
              Create a family group to track everyone&apos;s parkrun progress together.
            </p>
            <Link href="/family/new">
              <Button variant="primary" className="w-full">
                Create a family
              </Button>
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const { family, role: myRole } = familyData;
  const isAdmin = myRole === "admin";
  const memberCount = family.members.length;

  return (
    <div className="flex flex-col flex-1">
      <BackChevron />
      <main className="flex flex-col flex-1 w-full max-w-xl mx-auto px-4 py-6 gap-6">
        <div>
          <h1 className="text-2xl font-bold text-charcoal">{family.name}</h1>
          <p className="text-sm text-gray-400 mt-0.5">{memberCount} member{memberCount !== 1 ? "s" : ""}</p>
        </div>
        {/* Members list */}
        <section>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Members</h2>
          <ul className="bg-white rounded-2xl overflow-hidden divide-y divide-gray-100 shadow-sm">
            {family.members.map((m) => {
              const isSelf = m.user.id === account?.id;
              const canRemove = isAdmin || isSelf;
              return (
                <li key={m.id} className="flex items-center gap-3 px-4 py-3">
                  {/* Avatar placeholder */}
                  <div className="h-10 w-10 rounded-full bg-teal/20 flex items-center justify-center text-teal font-bold text-sm shrink-0">
                    {(m.user.name ?? m.user.email)[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-charcoal truncate">
                      {m.user.name ?? m.user.email}
                      {isSelf && <span className="text-gray-400 font-normal ml-1">(you)</span>}
                    </p>
                    {m.user.parkrunHomeEvent && (
                      <p className="text-xs text-gray-400 truncate">{m.user.parkrunHomeEvent}</p>
                    )}
                  </div>
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      m.role === "admin"
                        ? "bg-amber-100 text-amber-600"
                        : "bg-gray-100 text-gray-400"
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
            <p className="text-xs text-gray-400">
              Generate a link to send to someone. Links expire after 7 days and can only be used once.
            </p>

            {inviteError && (
              <div className="bg-red-50 rounded-xl px-4 py-3">
                <p className="text-sm text-red-600">{inviteError}</p>
                {inviteError.includes("limit") && (
                  <p className="text-xs text-gray-400 mt-1">
                    Upgrade coming soon — stay tuned!
                  </p>
                )}
              </div>
            )}

            {inviteUrl ? (
              <div className="space-y-2">
                  <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-4 py-3">
                  <p className="text-xs text-gray-500 truncate flex-1 font-mono">{inviteUrl}</p>
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="text-xs font-semibold text-teal hover:text-teal/80 shrink-0"
                  >
                    {copied ? "Copied!" : "Copy"}
                  </button>
                </div>
                <p className="text-xs text-gray-500">
                  Share this one link with anyone you want to invite — it can be used by multiple family members until the link expires (7 days).
                </p>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => { setInviteUrl(null); setInviteError(null); }}
                  className="w-full"
                >
                  Generate another
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="primary"
                onClick={handleGenerateInvite}
                disabled={inviteLoading}
                className="w-full"
              >
                {inviteLoading ? "Generating…" : "Generate invite link"}
              </Button>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
