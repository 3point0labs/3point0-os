import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getGmailOAuthClientId, getGmailOAuthClientSecret, refreshAccessToken } from "@/lib/gmail-oauth"

const KEYWORDS = ["sponsor", "partnership", "one54", "pressbox", "podcast"]

function matchesInboxFilter(from: string, subject: string): boolean {
  const blob = `${from} ${subject}`.toLowerCase()
  return KEYWORDS.some((k) => blob.includes(k))
}

type GmailMeta = {
  id: string
  internalDate?: string
  payload?: { headers?: Array<{ name: string; value: string }> }
}

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: row, error } = await supabase
    .from("gmail_tokens")
    .select("access_token, refresh_token")
    .eq("user_id", user.id)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!row?.access_token) {
    return NextResponse.json({ connected: false, emails: [] as unknown[] })
  }

  let accessToken = row.access_token as string
  const refreshToken = (row.refresh_token as string | null) ?? null

  const clientId = getGmailOAuthClientId()
  const clientSecret = getGmailOAuthClientSecret()

  const doFetchList = () =>
    fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=40", {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    })

  let listRes = await doFetchList()
  if (listRes.status === 401 && refreshToken && clientId && clientSecret) {
    try {
      const refreshed = await refreshAccessToken({ refreshToken, clientId, clientSecret })
      accessToken = refreshed.access_token
      await supabase
        .from("gmail_tokens")
        .update({ access_token: accessToken })
        .eq("user_id", user.id)
      listRes = await doFetchList()
    } catch {
      return NextResponse.json(
        { connected: true, error: "Gmail session expired. Reconnect Gmail.", emails: [] },
        { status: 200 }
      )
    }
  }

  if (!listRes.ok) {
    const t = await listRes.text()
    return NextResponse.json(
      { connected: true, error: `Gmail list failed: ${listRes.status}`, emails: [], detail: t.slice(0, 200) },
      { status: 200 }
    )
  }

  const listJson = (await listRes.json()) as { messages?: Array<{ id: string }> }
  const ids = (listJson.messages ?? []).map((m) => m.id)

  const details = await Promise.all(
    ids.map(async (id) => {
      const r = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
        { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" }
      )
      if (!r.ok) return null
      return (await r.json()) as GmailMeta
    })
  )

  const emails: Array<{ id: string; from: string; subject: string; time: string }> = []

  for (const msg of details) {
    if (!msg) continue
    const headers = msg.payload?.headers ?? []
    const get = (n: string) => headers.find((h) => h.name.toLowerCase() === n.toLowerCase())?.value ?? ""
    const from = get("From")
    const subject = get("Subject")
    if (!matchesInboxFilter(from, subject)) continue

    let time = ""
    if (msg.internalDate) {
      time = new Date(parseInt(msg.internalDate, 10)).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    } else {
      time = get("Date") || "—"
    }
    emails.push({ id: msg.id, from, subject: subject || "(no subject)", time })
    if (emails.length >= 5) break
  }

  return NextResponse.json({ connected: true, emails })
}
