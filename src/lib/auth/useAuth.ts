"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";

export function useAuth() {
  const { data: session, status } = useSession();
  const router = useRouter();

  return {
    account: session?.user ?? null,
    loading: status === "loading",
    login: () => router.push("/auth/signin"),
    logout: () => signOut({ callbackUrl: "/" }),
  };
}
