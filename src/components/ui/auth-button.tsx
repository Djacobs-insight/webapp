import { useAuth } from "@/lib/auth/useAuth";
import { Button } from "@/components/ui/button";

export function AuthButton() {
  const { account, loading, login, logout } = useAuth();

  if (loading) return null;

  if (!account) {
    return (
      <Button onClick={login} variant="secondary">
        Sign In
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm">{account.email}</span>
      <Button onClick={logout} variant="ghost">
        Sign Out
      </Button>
    </div>
  );
}
