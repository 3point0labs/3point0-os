import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import {
  exchangeCodeForTokens,
  getGmailOAuthClientId,
  getGmailOAuthClientSecret,
} from "@/lib/gmail-oauth"

const STATE_COOKIE = "gmail_oauth_state"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get("code")
  const state = url.searchParams.get("state")
  const err = url.searchParams.get("error")

  const origin = url.origin
  const command = `${origin}/command`

  if (err) {
    return NextResponse.redirect(`${command}?gmail_error=${encodeURIComponent(err)}`)
  }

  if (!code || !state) {
    return NextResponse.redirect(`${command}?gmail_error=missing_code`)
  }

  const cookieStore = await cookies()
  const expected = cookieStore.get(STATE_COOKIE)?.value
  if (!expected || expected !== state) {
    return NextResponse.redirect(`${command}?gmail_error=invalid_state`)
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  const clientId = getGmailOAuthClientId()
  const clientSecret = getGmailOAuthClientSecret()
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${command}?gmail_error=oauth_not_configured`)
  }

  const redirectUri = `${origin}/api/gmail/callback`

  let tokens: Awaited<ReturnType<typeof exchangeCodeForTokens>>
  try {
    tokens = await exchangeCodeForTokens({
      code,
      redirectUri,
      clientId,
      clientSecret,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "token_exchange_failed"
    return NextResponse.redirect(`${command}?gmail_error=${encodeURIComponent(msg.slice(0, 80))}`)
  }

  const { data: existing } = await supabase
    .from("gmail_tokens")
    .select("refresh_token")
    .eq("user_id", user.id)
    .maybeSingle()

  const refreshToken =
    tokens.refresh_token ?? (existing?.refresh_token as string | undefined) ?? null

  const { error: upsertError } = await supabase.from("gmail_tokens").upsert(
    {
      user_id: user.id,
      access_token: tokens.access_token,
      refresh_token: refreshToken,
    },
    { onConflict: "user_id" }
  )

  if (upsertError) {
    return NextResponse.redirect(`${command}?gmail_error=${encodeURIComponent(upsertError.message)}`)
  }

  const res = NextResponse.redirect(`${command}?gmail=connected`)
  res.cookies.delete(STATE_COOKIE)
  return res
}
