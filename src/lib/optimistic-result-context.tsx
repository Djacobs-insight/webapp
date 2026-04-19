"use client";

import React, { createContext, useContext, useState, useCallback, type SetStateAction, type Dispatch } from "react";
import type { MilestoneInfo } from "@/lib/actions/results";

export interface OptimisticResult {
  id: string; // temporary client-side id
  date: string;
  location: string;
  finishTimeSecs: number;
  ageGradedPct: number | null;
  pending: boolean;
}

interface PendingSubmission {
  date: string;
  location: string;
  finishTime: string;
}

interface OptimisticResultContextValue {
  optimisticResult: OptimisticResult | null;
  pendingSubmission: PendingSubmission | null;
  celebrationMilestones: MilestoneInfo[];
  setOptimisticResult: Dispatch<SetStateAction<OptimisticResult | null>>;
  setPendingSubmission: Dispatch<SetStateAction<PendingSubmission | null>>;
  setCelebrationMilestones: Dispatch<SetStateAction<MilestoneInfo[]>>;
  clearOptimistic: () => void;
}

const OptimisticResultContext = createContext<OptimisticResultContextValue>({
  optimisticResult: null,
  pendingSubmission: null,
  celebrationMilestones: [],
  setOptimisticResult: () => {},
  setPendingSubmission: () => {},
  setCelebrationMilestones: () => {},
  clearOptimistic: () => {},
});

export function OptimisticResultProvider({ children }: { children: React.ReactNode }) {
  const [optimisticResult, setOptimisticResult] = useState<OptimisticResult | null>(null);
  const [pendingSubmission, setPendingSubmission] = useState<PendingSubmission | null>(null);
  const [celebrationMilestones, setCelebrationMilestones] = useState<MilestoneInfo[]>([]);

  const clearOptimistic = useCallback(() => {
    setOptimisticResult(null);
    setPendingSubmission(null);
  }, []);

  return (
    <OptimisticResultContext.Provider
      value={{
        optimisticResult, pendingSubmission, celebrationMilestones,
        setOptimisticResult, setPendingSubmission, setCelebrationMilestones, clearOptimistic,
      }}
    >
      {children}
    </OptimisticResultContext.Provider>
  );
}

export function useOptimisticResult() {
  return useContext(OptimisticResultContext);
}
