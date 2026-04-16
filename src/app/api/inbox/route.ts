import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type GmailMessageSummary = {
  id: string;
  threadId: string;
}

type InboxEmail = {
  messageId: string;
  threadId: string;
  from: string;
  subject: string;
  snippet: string;
  date: string;
  isUnread: boolean;
}

export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("provider_token")
    .eq("id", user.id)
    .single();

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  const googleToken = profile?.provider_token as string | undefined;
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

    const data = (await res.json()) as { messages?: GmailMessageSummary[] };
    const messages = data.messages ?? [];

    // Fetch each message's details in parallel
    const details = await Promise.all(
      messages.map(async (m) => {
        const msgRes = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
          { headers: { Authorization: `Bearer ${googleToken}` } }
        );
        if (!msgRes.ok) return null;
        const msg = (await msgRes.json()) as {
          id: string;
          threadId: string;
          snippet?: string;
          labelIds?: string[];
          payload?: { headers?: Array<{ name: string; value: string }> };
        };

        const headers = msg.payload?.headers ?? [];
        const get = (name: string) =>
          headers.find((h) =>
            h.name.toLowerCase() === name.toLowerCase()
          )?.value ?? "";

        const email: InboxEmail = {
          messageId: msg.id,
          threadId: msg.threadId,
          from: get("From"),
          subject: get("Subject"),
          snippet: msg.snippet?.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&") ?? "",
          date: get("Date"),
          isUnread: (msg.labelIds ?? []).includes("UNREAD"),
        };
        return email;
      })
    );

    const emails = details.filter((d): d is InboxEmail => d !== null);
    return NextResponse.json({ emails });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}