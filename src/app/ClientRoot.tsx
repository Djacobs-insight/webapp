"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { SessionProvider } from "next-auth/react";
import { ToastProvider } from "@/components/ui/toast-provider";
import { BottomNav } from "@/components/ui/bottom-nav";
import { OnboardingWizard, isOnboardingCompleted } from "@/components/ui/onboarding-wizard";
import { OptimisticResultProvider, useOptimisticResult } from "@/lib/optimistic-result-context";
import { CelebrationOverlay } from "@/components/ui/celebration-overlay";
import { useAuth } from "@/lib/auth/useAuth";

const POST_LOGIN_REDIRECT_KEY = "sm_post_login_redirect";

function AppShell({ children }: { children: React.ReactNode }) {
  const { account, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { celebrationMilestones, setCelebrationMilestones } = useOptimisticResult();
  const userId = account?.id;
  const showOnboarding = !loading && !!account && !isOnboardingCompleted(userId);
  const [dismissed, setDismissed] = useState(false);

  // Once the user is signed in AND past onboarding, honor a pending post-login
  // redirect (e.g. set by the invite landing page before the auth round-trip).
  useEffect(() => {
    if (loading || !account) return;
    if (showOnboarding && !dismissed) return;
    if (typeof window === "undefined") return;
    const target = sessionStorage.getItem(POST_LOGIN_REDIRECT_KEY);
    if (!target) return;
    sessionStorage.removeItem(POST_LOGIN_REDIRECT_KEY);
    if (target.startsWith("/") && target !== pathname) {
      router.replace(target);
    }
  }, [loading, account, showOnboarding, dismissed, pathname, router]);

  return (
    <>
      <div className="flex-1 flex flex-col pb-16 md:pb-0">{children}</div>
      <BottomNav />
      {showOnboarding && !dismissed && (
        <OnboardingWizard userId={userId} onComplete={() => setDismissed(true)} />
      )}
      {celebrationMilestones.length > 0 && (
        <CelebrationOverlay
          milestones={celebrationMilestones}
          onDismiss={() => setCelebrationMilestones([])}
        />
      )}
    </>
  );
}

export default function ClientRoot({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ToastProvider>
        <OptimisticResultProvider>
          <AppShell>{children}</AppShell>
        </OptimisticResultProvider>
      </ToastProvider>
    </SessionProvider>
  );
}
