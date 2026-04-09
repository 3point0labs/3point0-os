import type { Podcast } from "./types";
import type { Profile } from "./types/profile";
import { createClient } from "./supabase/server";
import type { PodcastWorkspace } from "./intelligence";

function hasSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return Boolean(url?.trim() && key?.trim());
}

export async function getServerUser() {
  if (!hasSupabaseEnv()) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function getServerProfile(): Promise<Profile | null> {
  if (!hasSupabaseEnv()) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  if (error || !data) {
    return {
      id: user.id,
      email: user.email ?? null,
      name: (user.user_metadata?.full_name as string | undefined) ?? null,
      role: "partner",
      podcast_access: [],
    };
  }
  return data as Profile;
}

function podcastToAccessKey(podcast: PodcastWorkspace | Podcast): "One54" | "Pressbox Chronicles" {
  return podcast === "One54" ? "One54" : "Pressbox Chronicles";
}

/** Throws if partner cannot access this podcast (for server actions). */
export async function assertPodcastAccess(podcast: PodcastWorkspace | Podcast): Promise<void> {
  const profile = await getServerProfile();
  if (!profile) {
    throw new Error("Unauthorized");
  }
  if (profile.role === "admin" || profile.role === "team") {
    return;
  }
  const key = podcastToAccessKey(podcast);
  const allowed = profile.podcast_access ?? [];
  if (!allowed.includes(key)) {
    throw new Error("Access denied for this podcast");
  }
}
