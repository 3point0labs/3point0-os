import { promises as fs } from "fs";
import path from "path";

const FILE = path.join(process.cwd(), "data", "team-notes.json");

export type TeamNoteSender = "Marquel" | "Randy" | "Team";

/** Display badges: ONE54, PRESSBOX, or BOTH for org-wide notes */
export type TeamNotePodcastTag = "ONE54" | "PRESSBOX" | "BOTH";

export type TeamNote = {
  id: string;
  sender: TeamNoteSender;
  body: string;
  podcast: TeamNotePodcastTag;
  createdAt: string;
};

function isTeamNote(x: unknown): x is TeamNote {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    typeof o.body === "string" &&
    typeof o.createdAt === "string" &&
    (o.sender === "Marquel" || o.sender === "Randy" || o.sender === "Team") &&
    (o.podcast === "ONE54" || o.podcast === "PRESSBOX" || o.podcast === "BOTH")
  );
}

export async function readTeamNotes(): Promise<TeamNote[]> {
  const raw = await fs.readFile(FILE, "utf-8");
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(isTeamNote);
}

export async function writeTeamNotes(notes: TeamNote[]): Promise<void> {
  await fs.writeFile(FILE, JSON.stringify(notes, null, 2), "utf-8");
}
