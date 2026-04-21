import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getGmailOAuthClientId, getGmailOAuthClientSecret, refreshAccessToken } from "@/lib/gmail-oauth"
import { markSponsorContacted } from "@/lib/sponsors-mark-contacted"

type SendBody = {
  to: string
  subject: string
  body: string
  cc?: string
  bcc?: string
  sponsorId?: string
}

function toBase64Url(input: string): string {
  return Buffer.from(input, "utf-8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")
}

function encodeHeader(value: string): string {
  // eslint-disable-next-line no-control-regex
  if (/^[\x00-\x7F]*$/.test(value)) return value
  return `=?UTF-8?B?${Buffer.from(value, "utf-8").toString("base64")}?=`
}

function buildRawMessage(b: SendBody): string {
  const headers = [
    `To: ${b.to}`,
    b.cc ? `Cc: ${b.cc}` : "",
    b.bcc ? `Bcc: ${b.bcc}` : "",
    `Subject: ${encodeHeader(b.subject)}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: 7bit",
  ].filter(Boolean)

  return `${headers.join("\r\n")}\r\n\r\n${b.body}`
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: SendBody
  try {
    body = (await request.json()) as SendBody
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  if (!body.to || !body.subject || !body.body) {
    return NextResponse.json(
      { error: "Missing required fields: to, subject, body" },
      { status: 400 }
    )
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
    return NextResponse.json(
      { error: "Gmail not connected. Connect Gmail in Settings first." },
      { status: 400 }
    )
  }

  let accessToken = row.access_token as string
  const refreshToken = (row.refresh_token as string | null) ?? null
  const clientId = getGmailOAuthClientId()
  const clientSecret = getGmailOAuthClientSecret()

  const raw = toBase64Url(buildRawMessage(body))

  const doSend = () =>
    fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw }),
      cache: "no-store",
    })

  let sendRes = await doSend()

  if (sendRes.status === 401 && refreshToken && clientId && clientSecret) {
    try {
      const refreshed = await refreshAccessToken({ refreshToken, clientId, clientSecret })
      accessToken = refreshed.access_token
      await supabase
        .from("gmail_tokens")
        .update({ access_token: accessToken })
        .eq("user_id", user.id)
      sendRes = await doSend()
    } catch {
      return NextResponse.json(
        { error: "Gmail session expired. Reconnect Gmail." },
        { status: 401 }
      )
    }
  }

  if (!sendRes.ok) {
    const detail = await sendRes.text()
    return NextResponse.json(
      {
        error: `Gmail send failed: ${sendRes.status}`,
        detail: detail.slice(0, 300),
      },
      { status: 500 }
    )
  }

  const result = (await sendRes.json()) as { id?: string; threadId?: string }

  // Auto-advance sponsor stage + last_contact_date after successful send.
  // Failure here shouldn't break the send — log and continue.
  let sponsorUpdate: { stage?: string; error?: string } = {}
  if (body.sponsorId) {
    const marked = await markSponsorContacted(body.sponsorId)
    if (marked.ok) {
      sponsorUpdate = { stage: marked.stage }
    } else {
      sponsorUpdate = { error: marked.error }
    }
  }

  return NextResponse.json({
    sent: true,
    messageId: result.id,
    threadId: result.threadId,
    sponsor: sponsorUpdate,
  })
}