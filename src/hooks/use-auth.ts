import { api } from "@/convex/_generated/api";
import { useDegradedMode } from "@/components/ConvexGraceful";
import { useAuthActions } from "@convex-dev/auth/react";
import { useMutation, useQuery } from "convex/react";
import { useCallback, useRef, useState } from "react";

interface StoredUser {
  _id: string;
  name: string;
  username?: string;
  email?: string;
  image?: string;
  avatarUrl?: string;
  role?: string;
}

const AUTH_STORAGE_KEY = "asternal_auth";

function getStoredUser(): StoredUser | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return null;
}

function setStoredUser(user: StoredUser | null) {
  if (user) {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(AUTH_STORAGE_KEY);
  }
}

export function useAuth() {
  const { isDegraded, degradedUser } = useDegradedMode();

  // ── ALL hooks must be called unconditionally (Rules of Hooks) ──
  let currentUser: any = undefined;
  let registerMutation: any = async () => {};
  let loginMutation: any = async () => {};
  let authActions: any = { signIn: async () => {}, signOut: async () => {} };

  try {
    currentUser = useQuery(api.users.currentUser);
  } catch {
    /* Convex unavailable */
  }
  try {
    registerMutation = useMutation(api.users.register);
  } catch {
    /* Convex unavailable */
  }
  try {
    loginMutation = useMutation(api.users.login);
  } catch {
    /* Convex unavailable */
  }
  try {
    authActions = useAuthActions();
  } catch {
    /* Convex auth unavailable */
  }

  const loginRef = useRef(loginMutation);
  loginRef.current = loginMutation;
  const registerRef = useRef(registerMutation);
  registerRef.current = registerMutation;
  const authRef = useRef(authActions);
  authRef.current = authActions;

  const [storedUser, setStoredUserState] = useState<StoredUser | null>(
    getStoredUser,
  );

  const signIn = useCallback(
    async (username: string, password: string) => {
      // 1. Verify credentials via our custom mutation
      const result = await loginRef.current({ username, password });
      const userData: StoredUser = {
        _id: result._id as string,
        name: result.name,
        username: result.username,
        email: result.email,
        image: result.image,
        avatarUrl: result.avatarUrl,
        role: result.role,
      };

      // 2. Establish a Convex anonymous session so backend getAuthUserId works
      try {
        await authRef.current.signIn("anonymous");
      } catch {
        // Anonymous sign-in may fail in degraded mode — that's OK
      }

      setStoredUserState(userData);
      setStoredUser(userData);
      return userData;
    },
    [],
  );

  const register = useCallback(
    async (username: string, password: string, name?: string) => {
      // 1. Create user in users table
      const result = await registerRef.current({ username, password, name });
      const userData: StoredUser = {
        _id: result._id as string,
        name: result.name,
        username: result.username,
      };

      // 2. Establish a Convex anonymous session
      try {
        await authRef.current.signIn("anonymous");
      } catch {
        // OK in degraded mode
      }

      setStoredUserState(userData);
      setStoredUser(userData);
      return userData;
    },
    [],
  );

  const signOut = useCallback(() => {
    setStoredUserState(null);
    setStoredUser(null);
    // Also sign out from Convex auth
    try {
      authRef.current.signOut();
    } catch {
      // ignore
    }
    window.location.href = "/";
  }, []);

  // ── Conditional logic AFTER all hooks ────────────────────────

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
      register: async () => {},
    };
  }

  // Normal mode — prefer Convex data, fall back to stored data
  const user = currentUser ?? storedUser;
  const isLoading = currentUser === undefined && storedUser === null;
  const isAuthenticated = user !== null;

  return {
    isLoading,
    isAuthenticated,
    user,
    signIn,
    signOut,
    register,
  };
}
