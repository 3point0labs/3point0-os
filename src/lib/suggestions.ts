import { promises as fs } from "fs";
import path from "path";
import type { PodcastWorkspace } from "@/lib/intelligence";

const FILE = path.join(process.cwd(), "data", "suggestions.json");

export type PipelineSuggestion = {
  id: string;
  company: string;
  reason: string;
  category?: string;
  source: "episode";
  videoId: string;
  episodeTitle: string;
  podcast: PodcastWorkspace;
  createdAt: string;
};

export async function readSuggestions(): Promise<PipelineSuggestion[]> {
  try {
    const raw = await fs.readFile(FILE, "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed as PipelineSuggestion[];
  } catch {
    return [];
  }
}

export async function writeSuggestions(rows: PipelineSuggestion[]): Promise<void> {
  await fs.writeFile(FILE, JSON.stringify(rows, null, 2), "utf-8");
}
