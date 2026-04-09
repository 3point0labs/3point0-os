import { promises as fs } from "fs";
import path from "path";

export type PodcastWorkspace = "One54" | "Pressbox Chronicles";

export type SponsorOpportunity = {
  company: string;
  reason: string;
  category: string;
  urgency: "high" | "medium" | "low";
};

export type IntelligenceFinding = {
  brandMentions: string[];
  guestName: string;
  sponsorOpportunities: SponsorOpportunity[];
  keyTopics: string[];
  quotableStats: string[];
  pitchInsights: string[];
};

export type IntelligenceEntry = {
  videoId: string;
  podcast: PodcastWorkspace;
  title: string;
  analyzedAt: string;
  analysisTimeMs: number;
  tokenUsage: {
    input: number;
    output: number;
  };
  finding: IntelligenceFinding;
};

const FILE = path.join(process.cwd(), "data", "intelligence.json");

export async function readIntelligenceLog(): Promise<IntelligenceEntry[]> {
  try {
    const raw = await fs.readFile(FILE, "utf-8");
    return JSON.parse(raw) as IntelligenceEntry[];
  } catch {
    return [];
  }
}

export async function writeIntelligenceLog(entries: IntelligenceEntry[]) {
  await fs.writeFile(FILE, JSON.stringify(entries, null, 2), "utf-8");
}
