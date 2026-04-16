import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const LOCK_ERROR_SNIPPET = "lock was released because another request stole it";
const RETRY_DELAY_MS = 120;

function isLockError(error: unknown) {
  if (!(error instanceof Error)) return false;
  return error.message.toLowerCase().includes(LOCK_ERROR_SNIPPET);
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  let next = searchParams.get("next") ?? "/command";
  if (!next.startsWith("/")) next = "/command";

  if (code) {
    try {
      const supabase = await createClient();
      await supabase.auth.exchangeCodeForSession(code);
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.provider_token) {
        await supabase
          .from("profiles")
          .update({
            provider_token: session.provider_token,
            provider_refresh_token: session.provider_refresh_token ?? null,
          })
          .eq("id", session.user.id);
      }
    } catch (error) {
      if (!isLockError(error)) {
        throw error;
      }

      // Lock contention can occur during OAuth redirect bursts. Retry once.
      await sleep(RETRY_DELAY_MS);
      try {
        const retryClient = await createClient();
        await retryClient.auth.exchangeCodeForSession(code);
        const {
          data: { session },
        } = await retryClient.auth.getSession();
        if (session?.provider_token) {
          await retryClient
            .from("profiles")
            .update({
              provider_token: session.provider_token,
              provider_refresh_token: session.provider_refresh_token ?? null,
            })
            .eq("id", session.user.id);
        }
      } catch (retryError) {
        if (!isLockError(retryError)) {
          throw retryError;
        }
        return NextResponse.redirect(`${origin}/login?error=auth_lock`);
      }
    }
  }

  return NextResponse.redirect(`${origin}${next}`);
}
