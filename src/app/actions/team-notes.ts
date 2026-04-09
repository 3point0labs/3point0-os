"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import {
  readTeamNotes,
  writeTeamNotes,
  type TeamNotePodcastTag,
  type TeamNoteSender,
} from "@/lib/team-notes";
import { getServerProfile } from "@/lib/auth-server";

const SENDERS: TeamNoteSender[] = ["Marquel", "Randy", "Andrew", "Rich", "Heather", "CJ", "Team"];
const TAGS: TeamNotePodcastTag[] = ["ONE54", "PRESSBOX", "BOTH"];

export async function postTeamNote(input: {
  sender: TeamNoteSender;
  body: string;
  podcast: TeamNotePodcastTag;
}) {
  const body = input.body.trim();
  if (!body) return { ok: false as const, error: "Message is empty." };
  if (!SENDERS.includes(input.sender)) return { ok: false as const, error: "Invalid sender." };
  if (!TAGS.includes(input.podcast)) return { ok: false as const, error: "Invalid tag." };

  const notes = await readTeamNotes();
  notes.unshift({
    id: `tn-${randomUUID().slice(0, 10)}`,
    sender: input.sender,
    body,
    podcast: input.podcast,
    createdAt: new Date().toISOString(),
  });
  await writeTeamNotes(notes);
  revalidatePath("/command");
  return { ok: true as const };
}

export async function getFilteredTeamNotes() {
  const profile = await getServerProfile();
  const notes = await readTeamNotes();

  // Partners (Heather, CJ) only see ONE54 and BOTH tagged notes
  if (profile?.role === "partner") {
    return notes.filter((n) => n.podcast === "ONE54" || n.podcast === "BOTH");
  }

  // Admin and team see everything
  return notes;
}