import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) return NextResponse.json({ error: "No API key" }, { status: 500 });

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "mcp-client-2025-04-04",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2000,
        mcp_servers: [
          {
            type: "url",
            url: "https://gmail.mcp.claude.com/mcp",
            name: "gmail",
          },
        ],
        messages: [
          {
            role: "user",
            content: `Search Gmail for the 8 most recent emails that involve inquiries@one54africa.com — either sent to that address or received from it, or where you were CC'd on threads involving that address. Use the query: "inquiries@one54africa.com"

Return ONLY a valid JSON array, no other text, no markdown. Each object must have exactly these fields:
- messageId (string)
- threadId (string)  
- from (string)
- subject (string)
- snippet (string, max 200 chars)
- date (string, ISO format)
- isUnread (boolean)

Example: [{"messageId":"abc","threadId":"xyz","from":"someone@example.com","subject":"Hello","snippet":"Brief preview...","date":"2026-04-09T10:00:00Z","isUnread":true}]`,
          },
        ],
      }),
    });

    const data = await response.json();

    // Extract text from response
    const text = (data.content ?? [])
      .map((b: { type: string; text?: string }) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim();

    // Parse JSON array from response
    let emails = [];
    try {
      const match = text.match(/\[[\s\S]*\]/);
      if (match) {
        emails = JSON.parse(match[0]);
      }
    } catch {
      console.error("Failed to parse emails JSON:", text.slice(0, 500));
    }

    return NextResponse.json({ emails });
  } catch (e) {
    console.error("Inbox route error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();

  // Get the user's Google OAuth token from Supabase session
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const googleToken = session.provider_token;
  if (!googleToken) {
    return NextResponse.json({ 
      error: "No Google token. Please sign out and sign back in with Google." 
    }, { status: 401 });
  }

  try {
    // Call Gmail API directly with the OAuth token
    const res = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=inquiries%40one54africa.com&maxResults=8`,
      {
        headers: { Authorization: `Bearer ${googleToken}` },
      }
    );

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: err }, { status: res.status });
    }

    const data = await res.json();
    const messages = data.messages ?? [];

    // Fetch each message's details in parallel
    const details = await Promise.all(
      messages.map(async (m: { id: string; threadId: string }) => {
        const msgRes = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
          { headers: { Authorization: `Bearer ${googleToken}` } }
        );
        if (!msgRes.ok) return null;
        const msg = await msgRes.json();

        const headers = msg.payload?.headers ?? [];
        const get = (name: string) =>
          headers.find((h: { name: string; value: string }) =>
            h.name.toLowerCase() === name.toLowerCase()
          )?.value ?? "";

        return {
          messageId: msg.id,
          threadId: msg.threadId,
          from: get("From"),
          subject: get("Subject"),
          snippet: msg.snippet?.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&") ?? "",
          date: get("Date"),
          isUnread: (msg.labelIds ?? []).includes("UNREAD"),
        };
      })
    );

    const emails = details.filter(Boolean);
    return NextResponse.json({ emails });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}