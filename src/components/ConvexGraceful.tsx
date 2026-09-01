import React, { createContext, useContext, useCallback, useState } from "react";

// ── Degraded Mode Context ────────────────────────────────────────────
interface DegradedModeContextValue {
  isDegraded: boolean;
  degradedUser: {
    _id: string;
    name: string;
    email: string;
    image?: string;
    tokenIdentifier: string;
  } | null;
  enterDegradedMode: (error: unknown) => void;
}

const DegradedModeContext = createContext<DegradedModeContextValue>({
  isDegraded: false,
  degradedUser: null,
  enterDegradedMode: () => {},
});

export function useDegradedMode() {
  return useContext(DegradedModeContext);
}

// Try to recover a cached user from localStorage when Convex is unavailable
function getCachedUser(): DegradedModeContextValue["degradedUser"] {
  try {
    const keys = Object.keys(localStorage);
    for (const k of keys) {
      try {
        const v = localStorage.getItem(k);
        if (v && v.includes('"name"') && v.includes('"email"')) {
          const p = JSON.parse(v);
          if (p.name && p.email) {
            return {
              _id: p._id || "degraded-user",
              name: p.name,
              email: p.email,
              image: p.image,
              tokenIdentifier: "degraded",
            };
          }
        }
      } catch {
        // skip non-JSON entries
      }
    }
  } catch {
    // localStorage may not be available
  }
  return {
    _id: "degraded-user",
    name: "Vista previa",
    email: "preview@asternal.dev",
    tokenIdentifier: "degraded",
  };
}

// ── Convex Error Boundary ────────────────────────────────────────────
interface ErrorBoundaryState {
  hasError: boolean;
  error: unknown;
}

/**
 * Catches errors thrown by ConvexProvider or its children
 * (e.g., useQuery, useMutation when Convex is unreachable).
 */
class ConvexErrorBoundary extends React.Component<
  {
    children: React.ReactNode;
    onError: (error: unknown) => void;
  },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    console.warn("[ConvexGraceful] Caught error:", error.message);
    this.props.onError(error);
  }

  render() {
    if (this.state.hasError) {
      return this.props.children;
    }
    return this.props.children;
  }
}

// ── Provider ─────────────────────────────────────────────────────────
export function ConvexGracefulProvider({
  children,
  convexChildren,
  degradedChildren,
}: {
  children?: React.ReactNode;
  convexChildren: React.ReactNode;
  degradedChildren: React.ReactNode;
}) {
  const [isDegraded, setIsDegraded] = useState(false);
  const [degradedUser, setDegradedUser] =
    useState<DegradedModeContextValue["degradedUser"]>(null);

  const enterDegradedMode = useCallback(
    (error: unknown) => {
      if (isDegraded) return;
      console.warn(
        "[ConvexGraceful] Entering degraded mode due to:",
        error instanceof Error ? error.message : error,
      );
      setIsDegraded(true);
      setDegradedUser(getCachedUser());
    },
    [isDegraded],
  );

  const ctxValue: DegradedModeContextValue = {
    isDegraded,
    degradedUser,
    enterDegradedMode,
  };

  return (
    <DegradedModeContext.Provider value={ctxValue}>
      {isDegraded ? (
        <ConvexErrorBoundary onError={enterDegradedMode}>
          {degradedChildren}
        </ConvexErrorBoundary>
      ) : (
        <ConvexErrorBoundary onError={enterDegradedMode}>
          {convexChildren}
        </ConvexErrorBoundary>
      )}
    </DegradedModeContext.Provider>
  );
}
