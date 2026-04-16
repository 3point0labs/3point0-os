const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
].join(" ")

export function getGmailOAuthClientId(): string | null {
  const id = process.env.GOOGLE_GMAIL_CLIENT_ID ?? process.env.GMAIL_INTEGRATION_CLIENT_ID
  return id?.trim() ? id.trim() : null
}

export function getGmailOAuthClientSecret(): string | null {
  const s = process.env.GOOGLE_GMAIL_CLIENT_SECRET ?? process.env.GMAIL_INTEGRATION_CLIENT_SECRET
  return s?.trim() ? s.trim() : null
}

export function buildGoogleAuthorizeUrl(params: {
  clientId: string
  redirectUri: string
  state: string
}): string {
  const u = new URL("https://accounts.google.com/o/oauth2/v2/auth")
  u.searchParams.set("client_id", params.clientId)
  u.searchParams.set("redirect_uri", params.redirectUri)
  u.searchParams.set("response_type", "code")
  u.searchParams.set("scope", GMAIL_SCOPES)
  u.searchParams.set("access_type", "offline")
  u.searchParams.set("prompt", "consent")
  u.searchParams.set("include_granted_scopes", "true")
  u.searchParams.set("state", params.state)
  return u.toString()
}

type TokenResponse = {
  access_token: string
  refresh_token?: string
  expires_in?: number
  token_type?: string
}

export async function exchangeCodeForTokens(params: {
  code: string
  redirectUri: string
  clientId: string
  clientSecret: string
}): Promise<TokenResponse> {
  const body = new URLSearchParams({
    code: params.code,
    client_id: params.clientId,
    client_secret: params.clientSecret,
    redirect_uri: params.redirectUri,
    grant_type: "authorization_code",
  })
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  })
  const text = await res.text()
  if (!res.ok) {
    throw new Error(`Token exchange failed: ${res.status} ${text.slice(0, 200)}`)
  }
  return JSON.parse(text) as TokenResponse
}

export async function refreshAccessToken(params: {
  refreshToken: string
  clientId: string
  clientSecret: string
}): Promise<TokenResponse> {
  const body = new URLSearchParams({
    refresh_token: params.refreshToken,
    client_id: params.clientId,
    client_secret: params.clientSecret,
    grant_type: "refresh_token",
  })
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  })
  const text = await res.text()
  if (!res.ok) {
    throw new Error(`Token refresh failed: ${res.status} ${text.slice(0, 200)}`)
  }
  return JSON.parse(text) as TokenResponse
}
