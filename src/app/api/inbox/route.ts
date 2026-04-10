import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// This route fetches emails via the Gmail MCP on the server
// by calling the Anthropic API with Gmail MCP tools enabled
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
        max_tokens: 1000,
        tools: [],
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
            content: `Search Gmail for recent emails to or from inquiries@one54africa.com. Return the last 8 messages as JSON array with fields: messageId, threadId, from, subject, snippet, date, isUnread. Only return the JSON array, nothing else.`,
          },
        ],
      }),
    });

    const data = await response.json();
    const text = data.content?.map((b: { type: string; text?: string }) => b.type === "text" ? b.text : "").join("") ?? "[]";

    let emails = [];
    try {
      const match = text.match(/\[[\s\S]*\]/);
      if (match) emails = JSON.parse(match[0]);
    } catch { /* ignore */ }

    return NextResponse.json({ emails });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}