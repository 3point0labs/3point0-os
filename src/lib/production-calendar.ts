import { promises as fs } from "fs";
import path from "path";

const FILE = path.join(process.cwd(), "data", "production-calendar.json");

export type ProductionStatus = "Scheduled" | "Recording" | "Editing" | "Published";

export type ProductionEpisode = {
  id: string;
  title: string;
  guestName: string;
  recordDate: string;
  publishDate: string;
  podcast: "One54" | "Pressbox Chronicles";
  status: ProductionStatus;
};

export async function readProductionCalendar(): Promise<ProductionEpisode[]> {
  const raw = await fs.readFile(FILE, "utf-8");
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) return [];
  return parsed as ProductionEpisode[];
}

export async function writeProductionCalendar(entries: ProductionEpisode[]): Promise<void> {
  await fs.writeFile(FILE, JSON.stringify(entries, null, 2), "utf-8");
}
