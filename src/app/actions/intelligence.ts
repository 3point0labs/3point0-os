"use server";

import Anthropic from "@anthropic-ai/sdk";
import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { assertPodcastAccess } from "@/lib/auth-server";
import { getSponsors, saveSponsors } from "@/lib/data";
import { mergeEpisodeSuggestions } from "@/app/actions/suggestions";
import {
  readIntelligenceLog,
  writeIntelligenceLog,
  type IntelligenceEntry,
  type IntelligenceFinding,
  type PodcastWorkspace,
} from "@/lib/intelligence";

const YT_BASE = "https://www.googleapis.com/youtube/v3";
const MODEL = "claude-sonnet-4-20250514";

function channelHandleFor(podcast: PodcastWorkspace) {
  return podcast === "One54" ? "@One54Africa" : "@PressBoxChronicles";
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    let body = "";
    try {
      body = await res.text();
    } catch {
      body = "";
    }
    if (res.status === 401 || res.status === 403) {
      throw new Error("YouTube API authorization failed. Check YOUTUBE_API_KEY.");
    }
    throw new Error(`YouTube request failed (${res.status}). ${body.slice(0, 180)}`);
  }
  return (await res.json()) as T;
}

async function resolveChannelId(podcast: PodcastWorkspace, apiKey: string) {
  const handle = channelHandleFor(podcast);
  const url = `${YT_BASE}/channels?part=snippet,contentDetails,statistics&forHandle=${encodeURIComponent(
    handle.replace("@", "")
  )}&key=${apiKey}`;
  const data = await fetchJson<{
    items?: Array<{
      id: string;
      snippet?: { title?: string };
      statistics?: { subscriberCount?: string };
      contentDetails?: { relatedPlaylists?: { uploads?: string } };
    }>;
  }>(url);
  const item = data.items?.[0];
  if (!item) return null;
  return {
    channelId: item.id,
    channelTitle: item.snippet?.title ?? handle,
    subscribers: Number(item.statistics?.subscriberCount ?? 0),
    uploadsPlaylistId: item.contentDetails?.relatedPlaylists?.uploads ?? "",
    handle,
  };
}

export async function getLatestEpisodes(podcast: PodcastWorkspace, limit = 3): Promise<
  | {
      ok: true;
      episodes: Array<{
        id: string;
        title: string;
        publishedAt: string;
        thumbnail: string;
        views: number;
        channelTitle: string;
      }>;
      channel: { id: string; title: string; subscribers: number; handle: string };
      missingKey: false;
    }
  | { ok: false; error: string; missingKey: boolean }
> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey?.trim()) {
    return {
      ok: false,
      error: "YOUTUBE_API_KEY is missing. Add it to .env.local and redeploy.",
      missingKey: true,
    };
  }

  try {
    await assertPodcastAccess(podcast);
  } catch {
    return { ok: false, error: "Unauthorized", missingKey: false };
  }

  try {
    const channel = await resolveChannelId(podcast, apiKey);
    if (!channel) return { ok: false, error: "Could not resolve channel", missingKey: false };
    if (!channel.uploadsPlaylistId) {
      return { ok: false, error: "Channel uploads playlist missing", missingKey: false };
    }

    const playlistUrl = `${YT_BASE}/playlistItems?part=snippet,contentDetails&playlistId=${channel.uploadsPlaylistId}&maxResults=${limit}&key=${apiKey}`;
    const playlist = await fetchJson<{
      items: Array<{
        contentDetails?: { videoId?: string };
        snippet: {
          title: string;
          publishedAt: string;
          channelTitle: string;
          thumbnails?: { medium?: { url: string }; high?: { url: string } };
        };
      }>;
    }>(playlistUrl);

    const ids = playlist.items
      .map((i) => i.contentDetails?.videoId ?? "")
      .filter(Boolean);
    if (ids.length === 0)
      return {
        ok: true,
        episodes: [],
        channel: {
          id: channel.channelId,
          title: channel.channelTitle,
          subscribers: channel.subscribers,
          handle: channel.handle,
        },
        missingKey: false,
      };

    const statsUrl = `${YT_BASE}/videos?part=statistics&id=${ids.join(",")}&key=${apiKey}`;
    const stats = await fetchJson<{ items: Array<{ id: string; statistics?: { viewCount?: string } }> }>(statsUrl);
    const map = new Map(stats.items.map((s) => [s.id, Number(s.statistics?.viewCount ?? 0)]));

    const episodes = playlist.items.map((item) => ({
      id: item.contentDetails?.videoId ?? "",
      title: item.snippet.title,
      publishedAt: item.snippet.publishedAt,
      thumbnail:
        item.snippet.thumbnails?.high?.url ||
        item.snippet.thumbnails?.medium?.url ||
        `https://i.ytimg.com/vi/${item.contentDetails?.videoId ?? ""}/hqdefault.jpg`,
      views: map.get(item.contentDetails?.videoId ?? "") ?? 0,
      channelTitle: item.snippet.channelTitle,
    })).filter((e) => e.id);

    return {
      ok: true,
      episodes,
      channel: {
        id: channel.channelId,
        title: channel.channelTitle,
        subscribers: channel.subscribers,
        handle: channel.handle,
      },
      missingKey: false,
    };
  } catch (e) {
    const raw = e instanceof Error ? e.message : "Failed to fetch episodes";
    const clearMessage = raw.toLowerCase().includes("authorization")
      ? "YouTube API authorization failed. Verify YOUTUBE_API_KEY is valid and enabled for YouTube Data API."
      : raw;
    return {
      ok: false,
      error: clearMessage,
      missingKey: false,
    };
  }
}

async function fetchTranscript(videoId: string): Promise<string> {
  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const html = await (await fetch(watchUrl, { cache: "no-store" })).text();

  const tracksMatch = html.match(/"captionTracks":(\[.*?\])/);
  if (!tracksMatch) return "";
  const tracks = JSON.parse(tracksMatch[1]) as Array<{ baseUrl?: string }>;
  const base = tracks.find((t) => t.baseUrl)?.baseUrl;
  if (!base) return "";

  const xml = await (await fetch(base, { cache: "no-store" })).text();
  const parts = [...xml.matchAll(/<text[^>]*>([\s\S]*?)<\/text>/g)].map((m) =>
    decodeURIComponent(
      m[1]
        .replaceAll("&amp;", "&")
        .replaceAll("&#39;", "'")
        .replaceAll("&quot;", '"')
        .replaceAll("&lt;", "<")
        .replaceAll("&gt;", ">")
    )
  );
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

function parseFinding(raw: string): IntelligenceFinding {
  const cleaned = raw
    .replace(/^```json\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  const parsed = JSON.parse(cleaned) as IntelligenceFinding;
  return {
    brandMentions: parsed.brandMentions ?? [],
    guestName: parsed.guestName ?? "",
    sponsorOpportunities: parsed.sponsorOpportunities ?? [],
    keyTopics: parsed.keyTopics ?? [],
    quotableStats: parsed.quotableStats ?? [],
    pitchInsights: parsed.pitchInsights ?? [],
  };
}

export async function analyzeEpisode(
  videoId: string,
  podcast: PodcastWorkspace,
  title: string
): Promise<
  | { ok: true; cached: boolean; entry: IntelligenceEntry }
  | { ok: false; error: string }
> {
  try {
    await assertPodcastAccess(podcast);
  } catch {
    return { ok: false, error: "Unauthorized" };
  }

  const existing = await readIntelligenceLog();
  const hit = existing.find((e) => e.videoId === videoId && e.podcast === podcast);
  if (hit) return { ok: true, cached: true, entry: hit };

  const transcript = await fetchTranscript(videoId);
  if (!transcript) return { ok: false, error: "Transcript unavailable for this video." };

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey?.trim()) return { ok: false, error: "ANTHROPIC_API_KEY is missing." };

  const client = new Anthropic({ apiKey });
  const started = Date.now();
  try {
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 2400,
      system: `You are an intelligence agent for 3point0 Labs, a media company that produces ${podcast}. Your job is to analyze episode transcripts and find business opportunities.

Extract and return a JSON object with:
- brandMentions: array of any brand/company names mentioned
- guestName: the guest's full name and title if mentioned
- sponsorOpportunities: array of objects with {company, reason, category, urgency}
  where urgency is high/medium/low based on how naturally the topic came up
- keyTopics: array of main topics discussed
- quotableStats: any audience stats or numbers Jeff/hosts mentioned
- pitchInsights: 2-3 bullet points a sales rep could use when pitching sponsors
  based on what was discussed in this episode

Return ONLY valid JSON, no other text.`,
      messages: [{ role: "user", content: transcript }],
    });

    const raw = message.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim();
    const finding = parseFinding(raw);

    const entry: IntelligenceEntry = {
      videoId,
      podcast,
      title,
      analyzedAt: new Date().toISOString(),
      analysisTimeMs: Date.now() - started,
      tokenUsage: {
        input: message.usage.input_tokens,
        output: message.usage.output_tokens,
      },
      finding,
    };

    await writeIntelligenceLog([...existing, entry]);
    await mergeEpisodeSuggestions(entry);
    return { ok: true, cached: false, entry };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Analysis failed." };
  }
}

export async function addOpportunityToPipeline(input: {
  podcast: PodcastWorkspace;
  company: string;
  reason: string;
  category?: string;
}): Promise<{ ok: true; added: boolean } | { ok: false; error: string }> {
  try {
    await assertPodcastAccess(input.podcast);
  } catch {
    return { ok: false, error: "Unauthorized" };
  }

  const sponsors = await getSponsors();
  const exists = sponsors.some(
    (s) =>
      s.podcast === input.podcast &&
      s.company.trim().toLowerCase() === input.company.trim().toLowerCase()
  );
  if (exists) return { ok: true as const, added: false };

  sponsors.push({
    id: `sp-${randomUUID().slice(0, 8)}`,
    contactName: "Research Contact",
    company: input.company,
    email: "",
    podcast: input.podcast,
    stage: "New",
    lastContactDate: "",
    nextAction: "Identify decision-maker",
    notes: "Added from Intelligence feed",
    pitch_angle: input.reason,
    category: input.category,
    tier: "B",
  });

  await saveSponsors(sponsors);
  revalidatePath("/partnerships");
  revalidatePath("/command");
  return { ok: true as const, added: true };
}

export async function scanRecentEpisodes(podcast: PodcastWorkspace) {
  const latest = await getLatestEpisodes(podcast, 5);
  if (!latest.ok) return latest;

  const analyzed: IntelligenceEntry[] = [];
  for (const ep of latest.episodes) {
    const res = await analyzeEpisode(ep.id, podcast, ep.title);
    if (res.ok) analyzed.push(res.entry);
  }

  const aggregate = new Map<
    string,
    { company: string; mentions: number; reasons: string[]; category: string; urgency: string }
  >();

  for (const entry of analyzed) {
    for (const opp of entry.finding.sponsorOpportunities) {
      const key = opp.company.trim().toLowerCase();
      const prev = aggregate.get(key);
      if (prev) {
        prev.mentions += 1;
        prev.reasons.push(opp.reason);
      } else {
        aggregate.set(key, {
          company: opp.company,
          mentions: 1,
          reasons: [opp.reason],
          category: opp.category,
          urgency: opp.urgency,
        });
      }
    }
  }

  const opportunities = [...aggregate.values()].sort((a, b) => b.mentions - a.mentions);

  return { ok: true as const, episodes: latest.episodes, analyzed, opportunities };
}
