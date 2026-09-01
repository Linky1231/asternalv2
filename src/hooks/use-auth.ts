import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import {
  getCurrentUser,
  loginUser,
  registerUser,
  logoutUser,
} from "@/lib/db";

interface User {
  _id: string;
  name: string;
  username?: string;
  email?: string;
  image?: string;
  role?: string;
  isAuthenticated: boolean;
}

const AUTH_STORAGE_KEY = "asternal_auth";

// Simple in-memory cache for current user
let currentUserCache: User | null = null;
let authStateChecked = false;

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Check for cached user on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        // First check Supabase session
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session?.user) {
          // Get full profile from database
          const profile = await getCurrentUser();
          if (profile) {
            const userData: User = {
              _id: profile.id,
              name: profile.name || "Anónimo",
              username: profile.username,
              email: profile.email,
              image: profile.image,
              role: profile.role,
              isAuthenticated: true,
            };
            currentUserCache = userData;
            setUser(userData);
            // Cache in localStorage
            localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(userData));
          }
        } else {
          // No session, check localStorage cache
          const cached = localStorage.getItem(AUTH_STORAGE_KEY);
          if (cached) {
            const parsed = JSON.parse(cached);
            // Verify the cached user still exists
            try {
              const profile = await getCurrentUser();
              if (profile && profile.id === parsed._id) {
                currentUserCache = parsed;
                setUser(parsed);
              } else {
                // Cached user no longer valid
                localStorage.removeItem(AUTH_STORAGE_KEY);
                currentUserCache = null;
                setUser(null);
              }
            } catch {
              // Can't verify, use cache
              currentUserCache = parsed;
              setUser(parsed);
            }
          } else {
            currentUserCache = null;
            setUser(null);
          }
        }
      } catch (error) {
        console.error("Auth check failed:", error);
        // Use cache on error
        const cached = localStorage.getItem(AUTH_STORAGE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached);
          currentUserCache = parsed;
          setUser(parsed);
        }
      } finally {
        setLoading(false);
        authStateChecked = true;
      }
    };

    if (!authStateChecked) {
      checkAuth();
    } else {
      setLoading(false);
    }

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_IN" && session?.user) {
        const profile = await getCurrentUser();
        if (profile) {
          const userData: User = {
            _id: profile.id,
            name: profile.name || "Anónimo",
            username: profile.username,
            email: profile.email,
            image: profile.image,
            role: profile.role,
            isAuthenticated: true,
          };
          currentUserCache = userData;
          setUser(userData);
          localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(userData));
        }
      } else if (event === "SIGNED_OUT") {
        currentUserCache = null;
        setUser(null);
        localStorage.removeItem(AUTH_STORAGE_KEY);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(
    async (credentials?: { username?: string; password?: string }) => {
      if (!credentials?.username || !credentials?.password) {
        throw new Error("Se requiere nombre de usuario y contraseña");
      }

      try {
        const result = await loginUser(
          credentials.username,
          credentials.password
        );
        const userData: User = {
          _id: result._id,
          name: result.name,
          username: result.username,
          email: result.email,
          image: result.image,
          role: result.role,
          isAuthenticated: true,
        };
        currentUserCache = userData;
        setUser(userData);
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(userData));
        return userData;
      } catch (error) {
        throw error;
      }
    },
    []
  );

  const signUp = useCallback(
    async (credentials?: {
      username?: string;
      password?: string;
      name?: string;
    }) => {
      if (!credentials?.username || !credentials?.password) {
        throw new Error("Se requiere nombre de usuario y contraseña");
      }

      try {
        const result = await registerUser(
          credentials.username,
          credentials.password,
          credentials.name
        );
        const userData: User = {
          _id: result._id,
          name: result.name,
          username: result.username,
          isAuthenticated: true,
        };
        currentUserCache = userData;
        setUser(userData);
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(userData));
        return userData;
      } catch (error) {
        throw error;
      }
    },
    []
  );

  const signOut = useCallback(async () => {
    try {
      await logoutUser();
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      currentUserCache = null;
      setUser(null);
      localStorage.removeItem(AUTH_STORAGE_KEY);
    }
  }, []);

  return {
    user,
    loading,
    signIn,
    signUp,
    signOut,
    isAuthenticated: user?.isAuthenticated ?? false,
  };
}
