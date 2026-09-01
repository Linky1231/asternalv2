import { api } from "@/convex/_generated/api";
import { useDegradedMode } from "@/components/ConvexGraceful";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useQuery } from "convex/react";

export function useAuth() {
  const { isDegraded, degradedUser } = useDegradedMode();
  const { signIn, signOut } = useAuthActions();

  // In degraded mode, bypass Convex entirely and return cached/fallback user
  if (isDegraded) {
    return {
      isLoading: false,
      isAuthenticated: degradedUser !== null,
      user: degradedUser,
      signIn,
      signOut,
    };
  }

  // Normal mode — use Convex as usual
  const { isLoading: isAuthLoading, isAuthenticated } = useConvexAuth();
  const user = useQuery(api.users.currentUser);

  const isLoading = isAuthLoading || user === undefined;

  return {
    isLoading,
    isAuthenticated,
    user,
    signIn,
    signOut,
  };
}
