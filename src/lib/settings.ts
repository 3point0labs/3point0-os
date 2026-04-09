import { promises as fs } from "fs";
import path from "path";

const FILE = path.join(process.cwd(), "data", "settings.json");

export type DiscoveryFrequency = "daily" | "weekly";

export type AppSettings = {
  autoDiscovery: boolean;
  frequency: DiscoveryFrequency;
  contactsPerRun: 10 | 25;
  podcasts: Array<"One54" | "Pressbox Chronicles">;
  lastDiscoveryRunAt: string | null;
};

const defaultSettings: AppSettings = {
  autoDiscovery: false,
  frequency: "weekly",
  contactsPerRun: 10,
  podcasts: ["One54", "Pressbox Chronicles"],
  lastDiscoveryRunAt: null,
};

export async function readSettings(): Promise<AppSettings> {
  try {
    const raw = await fs.readFile(FILE, "utf-8");
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return {
      ...defaultSettings,
      ...parsed,
      podcasts:
        Array.isArray(parsed.podcasts) && parsed.podcasts.length > 0
          ? (parsed.podcasts.filter((p) => p === "One54" || p === "Pressbox Chronicles") as AppSettings["podcasts"])
          : defaultSettings.podcasts,
    };
  } catch {
    return { ...defaultSettings };
  }
}

export async function writeSettings(settings: AppSettings): Promise<void> {
  await fs.writeFile(FILE, JSON.stringify(settings, null, 2), "utf-8");
}
