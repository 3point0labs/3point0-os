import { promises as fs } from "fs";
import path from "path";
import type { DashboardData, Sponsor } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const SPONSORS_FILE = path.join(DATA_DIR, "sponsors.json");
const DASHBOARD_FILE = path.join(DATA_DIR, "dashboard.json");

export async function getSponsors(): Promise<Sponsor[]> {
  const raw = await fs.readFile(SPONSORS_FILE, "utf-8");
  return JSON.parse(raw) as Sponsor[];
}

export async function saveSponsors(sponsors: Sponsor[]): Promise<void> {
  await fs.writeFile(SPONSORS_FILE, JSON.stringify(sponsors, null, 2), "utf-8");
}

export async function getDashboard(): Promise<DashboardData> {
  const raw = await fs.readFile(DASHBOARD_FILE, "utf-8");
  return JSON.parse(raw) as DashboardData;
}
