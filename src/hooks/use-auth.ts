import { api } from "@/convex/_generated/api";
import { useDegradedMode } from "@/components/ConvexGraceful";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useQuery } from "convex/react";
import { useMemo } from "react";

/**
 * Safe wrapper around useAuthActions that returns no-op functions
 * when Convex auth context is unavailable (degraded mode).
 */
function useSafeAuthActions() {
  const { isDegraded } = useDegradedMode();
  // Always call the hook to satisfy Rules of Hooks
  let actions: any = { signIn: async () => {}, signOut: async () => {} };
  try {
    actions = useAuthActions();
  } catch {
    // Convex auth context unavailable — use fallback no-ops
  }
  if (isDegraded) {
    return { signIn: async () => {}, signOut: async () => {} } as any;
  }
  return actions;
}

/**
 * Safe wrapper around useConvexAuth that returns defaults when unavailable.
 */
function useSafeConvexAuth() {
  const { isDegraded } = useDegradedMode();
  let result = { isLoading: true, isAuthenticated: false };
  try {
    result = useConvexAuth();
  } catch {
    // Convex context unavailable
  }
  if (isDegraded) {
    return { isLoading: false, isAuthenticated: true };
  }
  return result;
}

export function useAuth() {
  const { isDegraded, degradedUser } = useDegradedMode();
  const { signIn, signOut } = useSafeAuthActions();
  const { isLoading: isAuthLoading, isAuthenticated } = useSafeConvexAuth();
  const user = useQuery(api.users.currentUser);

  // In degraded mode, bypass Convex entirely — anonymous access
  if (isDegraded) {
    return {
      isLoading: false,
      isAuthenticated: true,
      user: degradedUser ?? {
        _id: "anonymous",
        name: "Anónimo",
        email: "",
        tokenIdentifier: "anonymous",
      },
      signIn: async () => {},
      signOut: async () => {},
    };
  }

  // Normal mode
  const isLoading = isAuthLoading || user === undefined;

  return {
    isLoading,
    isAuthenticated,
    user,
    signIn,
    signOut,
  };
}
