import type { PodcastWorkspace } from "./intelligence";
import type { Podcast } from "./types";
import type { Profile, UserRole } from "./types/profile";
import type { TeamNote } from "./team-notes";

/** Map DB podcast_access values to Sponsor.podcast */
export function profileAllowsPodcast(profile: Profile | null, podcast: Podcast): boolean {
  if (!profile) return true;
  if (profile.role === "admin" || profile.role === "team") return true;
  const allowed = profile.podcast_access ?? [];
  const key = podcast === "One54" ? "One54" : "Pressbox Chronicles";
  return allowed.includes(key);
}

export function filterSponsorsByProfile<T extends { podcast: Podcast }>(
  rows: T[],
  profile: Profile | null
): T[] {
  if (!profile || profile.role === "admin" || profile.role === "team") return rows;
  return rows.filter((s) => profileAllowsPodcast(profile, s.podcast));
}

export function filterTeamNotesByProfile(notes: TeamNote[], profile: Profile | null): TeamNote[] {
  if (!profile || profile.role === "admin" || profile.role === "team") return notes;
  const allowed = profile.podcast_access ?? [];
  const hasOne54 = allowed.includes("One54");
  const hasPb = allowed.includes("Pressbox Chronicles");
  return notes.filter((n) => {
    if (n.podcast === "BOTH") return hasOne54 || hasPb;
    if (n.podcast === "ONE54") return hasOne54;
    if (n.podcast === "PRESSBOX") return hasPb;
    return false;
  });
}

export function roleCanUseSettings(role: UserRole | undefined): boolean {
  return role === "admin" || role === "team";
}

/** Rows keyed by workspace podcast (One54 / Pressbox Chronicles). */
export function filterRowsByPodcastAccess<T extends { podcast: PodcastWorkspace }>(
  rows: T[],
  profile: Profile | null
): T[] {
  if (!profile || profile.role === "admin" || profile.role === "team") return rows;
  const allowed = profile.podcast_access ?? [];
  return rows.filter((r) => {
    const key = r.podcast === "One54" ? "One54" : "Pressbox Chronicles";
    return allowed.includes(key);
  });
}
