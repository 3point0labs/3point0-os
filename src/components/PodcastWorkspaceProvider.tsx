"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useAuth } from "@/hooks/useAuth";

export type ActivePodcast = "One54" | "Pressbox Chronicles";

type Ctx = {
  activePodcast: ActivePodcast;
  setActivePodcast: (p: ActivePodcast) => void;
  accent: string;
  /** Podcasts this user may work in (from profile.podcast_access) */
  allowedPodcasts: ActivePodcast[];
};

const KEY = "3point0.activePodcast";

const PodcastWorkspaceContext = createContext<Ctx | null>(null);

/** One54 = leather, Pressbox = coral */
function accentFor(podcast: ActivePodcast) {
  return podcast === "Pressbox Chronicles" ? "#e8533d" : "#c9a87c";
}

function accentRgbFor(podcast: ActivePodcast) {
  return podcast === "Pressbox Chronicles" ? "232, 83, 61" : "201, 168, 124";
}

function accessToAllowed(profile: ReturnType<typeof useAuth>["profile"], loading: boolean): ActivePodcast[] {
  if (loading || !profile) return ["One54", "Pressbox Chronicles"];
  if (profile.role === "admin" || profile.role === "team") return ["One54", "Pressbox Chronicles"];
  const acc = profile.podcast_access ?? [];
  const out: ActivePodcast[] = [];
  if (acc.includes("One54")) out.push("One54");
  if (acc.includes("Pressbox Chronicles")) out.push("Pressbox Chronicles");
  return out.length ? out : ["One54"];
}

export function PodcastWorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { profile, loading } = useAuth();
  const [activePodcast, setActivePodcastState] = useState<ActivePodcast>("One54");

  const allowedPodcasts = useMemo(
    () => accessToAllowed(profile, loading),
    [profile, loading]
  );

  useEffect(() => {
    const stored = window.localStorage.getItem(KEY);
    if (stored === "One54" || stored === "Pressbox Chronicles") {
      setActivePodcastState(stored);
    }
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!allowedPodcasts.includes(activePodcast)) {
      setActivePodcastState(allowedPodcasts[0] ?? "One54");
    }
  }, [loading, allowedPodcasts, activePodcast]);

  const setActivePodcast = useCallback(
    (p: ActivePodcast) => {
      if (allowedPodcasts.includes(p)) setActivePodcastState(p);
    },
    [allowedPodcasts]
  );

  useEffect(() => {
    window.localStorage.setItem(KEY, activePodcast);
    document.documentElement.style.setProperty("--accent", accentFor(activePodcast));
    document.documentElement.style.setProperty("--accent-rgb", accentRgbFor(activePodcast));
  }, [activePodcast]);

  const value = useMemo(
    () => ({
      activePodcast,
      setActivePodcast,
      accent: accentFor(activePodcast),
      allowedPodcasts,
    }),
    [activePodcast, setActivePodcast, allowedPodcasts]
  );

  return (
    <PodcastWorkspaceContext.Provider value={value}>{children}</PodcastWorkspaceContext.Provider>
  );
}

export function usePodcastWorkspace() {
  const ctx = useContext(PodcastWorkspaceContext);
  if (!ctx) throw new Error("usePodcastWorkspace must be used within provider");
  return ctx;
}
