"use client";
import { useState, useEffect } from "react";
import { ToastProvider } from "@/components/ui/toast-provider";
import { BottomNav } from "@/components/ui/bottom-nav";
import { OnboardingWizard, isOnboardingCompleted } from "@/components/ui/onboarding-wizard";
import { useAuth } from "@/lib/auth/useAuth";

function AppShell({ children }: { children: React.ReactNode }) {
  const { account, loading } = useAuth();
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    if (!loading && account && !isOnboardingCompleted()) {
      setShowOnboarding(true);
    }
  }, [loading, account]);

  return (
    <>
      <div className="flex-1 flex flex-col pb-16 md:pb-0">{children}</div>
      <BottomNav />
      {showOnboarding && (
        <OnboardingWizard onComplete={() => setShowOnboarding(false)} />
      )}
    </>
  );
}

export default function ClientRoot({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <AppShell>{children}</AppShell>
    </ToastProvider>
  );
}
