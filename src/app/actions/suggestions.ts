"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { getSponsors, saveSponsors } from "@/lib/data";
import type { IntelligenceEntry } from "@/lib/intelligence";
import type { PodcastWorkspace } from "@/lib/intelligence";
import {
  readSuggestions,
  writeSuggestions,
  type PipelineSuggestion,
} from "@/lib/suggestions";

export async function getSuggestionCount(): Promise<number> {
  const rows = await readSuggestions();
  return rows.length;
}

export async function getSuggestionsList(): Promise<PipelineSuggestion[]> {
  return readSuggestions();
}

export async function removeSuggestion(id: string): Promise<void> {
  const rows = await readSuggestions();
  await writeSuggestions(rows.filter((r) => r.id !== id));
  revalidatePath("/partnerships");
}

export async function addSuggestionToPipeline(id: string): Promise<
  { ok: true; added: boolean } | { ok: false; error: string }
> {
  const rows = await readSuggestions();
  const sug = rows.find((r) => r.id === id);
  if (!sug) return { ok: false, error: "Suggestion not found." };

  const sponsors = await getSponsors();
  const exists = sponsors.some(
    (s) => s.company.trim().toLowerCase() === sug.company.trim().toLowerCase()
  );
  if (exists) {
    await writeSuggestions(rows.filter((r) => r.id !== id));
    revalidatePath("/partnerships");
    return { ok: true, added: false };
  }

  sponsors.push({
    id: `sp-${randomUUID().slice(0, 8)}`,
    contactName: "Research contact",
    company: sug.company,
    email: "",
    podcast: sug.podcast,
    stage: "New",
    lastContactDate: "",
    nextAction: "Identify decision-maker",
    notes: `Suggested from episode: ${sug.episodeTitle}`,
    pitch_angle: sug.reason,
    category: sug.category,
    tier: "B",
  });

  await saveSponsors(sponsors);
  await writeSuggestions(rows.filter((r) => r.id !== id));
  revalidatePath("/partnerships");
  revalidatePath("/command");
  return { ok: true, added: true };
}

/** After episode analysis — add opportunities not already in pipeline */
export async function mergeEpisodeSuggestions(entry: IntelligenceEntry): Promise<void> {
  const sponsors = await getSponsors();
  const companies = new Set(sponsors.map((s) => s.company.trim().toLowerCase()));

  const existing = await readSuggestions();
  const sugKeys = new Set(existing.map((s) => s.company.trim().toLowerCase()));

  const podcast: PodcastWorkspace = entry.podcast;
  const newRows: PipelineSuggestion[] = [...existing];

  for (const opp of entry.finding.sponsorOpportunities) {
    const key = opp.company.trim().toLowerCase();
    if (!key || companies.has(key) || sugKeys.has(key)) continue;
    sugKeys.add(key);
    newRows.push({
      id: `sg-${randomUUID().slice(0, 10)}`,
      company: opp.company.trim(),
      reason: opp.reason,
      category: opp.category,
      source: "episode",
      videoId: entry.videoId,
      episodeTitle: entry.title,
      podcast,
      createdAt: new Date().toISOString(),
    });
  }

  if (newRows.length !== existing.length) {
    await writeSuggestions(newRows);
    revalidatePath("/partnerships");
    revalidatePath("/broadcast");
  }
}
