"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/useAuth";
import { getInviteByToken, acceptInvite } from "@/lib/actions/family";
import { Button } from "@/components/ui/button";
import Link from "next/link";

type InviteInfo = {
  familyName: string;
  invitedByName: string | null;
  memberCount: number;
  expired: boolean;
  used: boolean;
};

export default function InvitePage({ params }: { params: { token: string } }) {
  const { account, loading: authLoading } = useAuth();
  const router = useRouter();
  const { token } = params;

  const [inviteInfo, setInviteInfo] = useState<InviteInfo | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const invite = await getInviteByToken(token);
        if (!invite) {
          setNotFound(true);
          setPageLoading(false);
          return;
        }
        setInviteInfo({
          familyName: invite.family.name,
          invitedByName: invite.invitedBy.name,
          memberCount: invite.family.members.length,
          expired: invite.expiresAt < new Date(),
          used: !!invite.usedAt,
        });
      } catch {
        setNotFound(true);
      } finally {
        setPageLoading(false);
      }
    }
    load();
  }, [token]);

  async function handleJoin() {
    if (!account) {
      // Redirect to home — MSAL login will return them here via redirect URI
      // Store the invite path so they can return after login
      sessionStorage.setItem("sm_post_login_redirect", `/invite/${token}`);
      router.push("/");
      return;
    }

    setJoining(true);
    setJoinError(null);
    const result = await acceptInvite({ token, userId: account.localAccountId });
    setJoining(false);

    if (!result.success) {
      setJoinError(result.error);
      return;
    }
    router.push("/family");
  }

  if (pageLoading || authLoading) {
    return (
      <main className="min-h-screen bg-warm-white flex items-center justify-center">
        <p className="text-charcoal/50 text-sm">Loading invite…</p>
      </main>
    );
  }

  if (notFound) {
    return (
      <main className="min-h-screen bg-warm-white flex flex-col items-center justify-center px-6 text-center">
        <div className="text-5xl mb-4">🔗</div>
        <h1 className="text-xl font-bold text-charcoal mb-2">Invite not found</h1>
        <p className="text-charcoal/60 text-sm mb-8">
          This invite link is invalid. Ask the family admin to generate a new one.
        </p>
        <Link href="/">
          <Button className="bg-coral text-white rounded-full px-6 py-3 font-semibold">
            Go to Saturday Morning
          </Button>
        </Link>
      </main>
    );
  }

  const { familyName, invitedByName, memberCount, expired, used } = inviteInfo!;
  const isInvalid = expired || used;

  return (
    <main className="min-h-screen bg-warm-white flex flex-col items-center justify-center px-6 pb-10">
      <div className="w-full max-w-sm text-center space-y-4">
        {/* Brand mark */}
        <div className="text-5xl mb-2">🏃</div>
        <p className="text-xs font-semibold text-teal uppercase tracking-widest">Saturday Morning</p>

        {isInvalid ? (
          <>
            <h1 className="text-2xl font-bold text-charcoal">Invite {used ? "already used" : "expired"}</h1>
            <p className="text-charcoal/60 text-sm">
              {used
                ? "This invite link has already been used."
                : "This invite link expired after 7 days."}
              {" "}Ask <strong>{invitedByName ?? "the family admin"}</strong> to send you a new one.
            </p>
            <Link href="/">
              <Button className="mt-4 bg-charcoal/10 text-charcoal rounded-full px-6 py-3 font-semibold">
                Go to home
              </Button>
            </Link>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-charcoal">
              You&apos;re invited to join
            </h1>
            <p className="text-3xl font-bold text-coral mt-1">{familyName}</p>
            <p className="text-charcoal/60 text-sm mt-1">
              {invitedByName ? (
                <>
                  <strong>{invitedByName}</strong> has invited you to track parkrun results together.
                </>
              ) : (
                "You&apos;ve been invited to track parkrun results together."
              )}
            </p>

            <div className="bg-white rounded-2xl px-4 py-3 shadow-sm mt-2">
              <p className="text-charcoal/60 text-xs">Current members</p>
              <p className="text-2xl font-bold text-charcoal">{memberCount}</p>
            </div>

            {joinError && (
              <div className="bg-red-50 rounded-xl px-4 py-3 text-left">
                <p className="text-sm text-red-600">{joinError}</p>
              </div>
            )}

            <Button
              type="button"
              onClick={handleJoin}
              disabled={joining}
              className="w-full bg-coral hover:bg-coral/90 text-white rounded-full py-4 font-semibold text-base mt-2 disabled:opacity-50"
            >
              {joining
                ? "Joining…"
                : account
                ? `Join ${familyName}`
                : "Sign in to join"}
            </Button>

            {!account && (
              <p className="text-charcoal/50 text-xs mt-2">
                You&apos;ll be asked to sign in or create an account first.
              </p>
            )}
          </>
        )}
      </div>
    </main>
  );
}
