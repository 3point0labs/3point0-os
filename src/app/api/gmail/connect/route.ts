import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { buildGoogleAuthorizeUrl, getGmailOAuthClientId } from "@/lib/gmail-oauth"

const STATE_COOKIE = "gmail_oauth_state"
const STATE_MAX_AGE = 600

export async function GET(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  const clientId = getGmailOAuthClientId()
  if (!clientId) {
    return NextResponse.json(
      { error: "Gmail OAuth is not configured. Set GOOGLE_GMAIL_CLIENT_ID in the server environment." },
      { status: 500 }
    )
  }

  const origin = new URL(request.url).origin
  const redirectUri = `${origin}/api/gmail/callback`
  const state = crypto.randomUUID()

  const googleUrl = buildGoogleAuthorizeUrl({
    clientId,
    redirectUri,
    state,
  })

  const res = NextResponse.redirect(googleUrl)
  res.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: STATE_MAX_AGE,
  })
  return res
}
