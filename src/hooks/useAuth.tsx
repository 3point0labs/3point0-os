"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import type { Profile, UserRole } from "@/lib/types/profile";

type AuthState = {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
};

export type AuthContextValue = {
  user: User | null;
  profile: Profile | null;
  role: UserRole | undefined;
  podcastAccess: string[];
  loading: boolean;
  isAdmin: boolean;
  isTeam: boolean;
  isPartner: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function fallbackProfile(user: User): Profile {
  return {
    id: user.id,
    email: user.email ?? null,
    name: (user.user_metadata?.full_name as string | undefined) ?? null,
    role: "partner",
    podcast_access: [],
  };
}

function useProvideAuth(): AuthContextValue {
  const router = useRouter();
  const supabaseRef = useRef<SupabaseClient | null>(null);
  const [state, setState] = useState<AuthState>({
    user: null,
    profile: null,
    loading: true,
  });

  const fetchProfile = useCallback(async (user: User) => {
    const supabase = supabaseRef.current;
    if (!supabase) return fallbackProfile(user);
    const { data, error } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
    if (!error && data) return data as Profile;
    return fallbackProfile(user);
  }, []);

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url?.trim() || !key?.trim()) {
      setState({ user: null, profile: null, loading: false });
      return;
    }

    const supabase = createClient();
    supabaseRef.current = supabase;

    let cancelled = false;

    async function init() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user ?? null;
      if (!user) {
        if (!cancelled) setState({ user: null, profile: null, loading: false });
        return;
      }
      const profile = await fetchProfile(user);
      if (!cancelled) setState({ user, profile, loading: false });
    }

    void init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const user = session?.user ?? null;
      if (!user) {
        setState({ user: null, profile: null, loading: false });
        return;
      }
      const profile = await fetchProfile(user);
      setState({ user, profile, loading: false });
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
      supabaseRef.current = null;
    };
  }, [fetchProfile]);

  const signOut = useCallback(async () => {
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error("Failed to sign out", error);
      }
    } catch (error) {
      console.error("Unexpected sign out error", error);
    } finally {
      // Clear cached auth/profile data in memory before routing away
      setState({ user: null, profile: null, loading: false });
      router.push("/login");
      router.refresh();
    }
  }, [router]);

  const refreshProfile = useCallback(async () => {
    const supabase = supabaseRef.current;
    if (!supabase) return;
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user ?? null;
    if (!user) return;
    const profile = await fetchProfile(user);
    setState((s) => (s.user ? { ...s, profile } : s));
  }, [fetchProfile]);

  const role = state.profile?.role;
  const podcastAccess = state.profile?.podcast_access ?? [];

  return {
    user: state.user,
    profile: state.profile,
    role,
    podcastAccess,
    loading: state.loading,
    isAdmin: role === "admin",
    isTeam: role === "team",
    isPartner: role === "partner",
    signOut,
    refreshProfile,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const value = useProvideAuth();
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}

export type AuthRole = UserRole;
