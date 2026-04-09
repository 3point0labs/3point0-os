"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import {
  readProductionCalendar,
  writeProductionCalendar,
  type ProductionEpisode,
  type ProductionStatus,
} from "@/lib/production-calendar";

export async function addProductionEpisode(input: {
  title: string;
  guestName: string;
  recordDate: string;
  publishDate: string;
  podcast: "One54" | "Pressbox Chronicles";
  status: ProductionStatus;
}) {
  const title = input.title.trim();
  if (!title) return { ok: false as const, error: "Title required." };

  const entries = await readProductionCalendar();
  const next: ProductionEpisode = {
    id: `pe-${randomUUID().slice(0, 10)}`,
    title,
    guestName: input.guestName.trim(),
    recordDate: input.recordDate,
    publishDate: input.publishDate,
    podcast: input.podcast,
    status: input.status,
  };
  entries.push(next);
  entries.sort((a, b) => a.publishDate.localeCompare(b.publishDate));
  await writeProductionCalendar(entries);
  revalidatePath("/broadcast");
  return { ok: true as const };
}
