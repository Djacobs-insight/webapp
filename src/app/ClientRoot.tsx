"use client";
import { useState } from "react";
import { SessionProvider } from "next-auth/react";
import { ToastProvider } from "@/components/ui/toast-provider";
import { BottomNav } from "@/components/ui/bottom-nav";
import { OnboardingWizard, isOnboardingCompleted } from "@/components/ui/onboarding-wizard";
import { OptimisticResultProvider, useOptimisticResult } from "@/lib/optimistic-result-context";
import { CelebrationOverlay } from "@/components/ui/celebration-overlay";
import { useAuth } from "@/lib/auth/useAuth";

function AppShell({ children }: { children: React.ReactNode }) {
  const { account, loading } = useAuth();
  const { celebrationMilestones, setCelebrationMilestones } = useOptimisticResult();
  const userId = account?.id;
  const showOnboarding = !loading && !!account && !isOnboardingCompleted(userId);
  const [dismissed, setDismissed] = useState(false);

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
