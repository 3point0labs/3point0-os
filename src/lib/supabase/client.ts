import { createBrowserClient } from "@supabase/ssr";

type CreateClientOptions = {
  isAuthCallback?: boolean;
};

export function createClient(options: CreateClientOptions = {}) {
  const { isAuthCallback = false } = options;

  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: !isAuthCallback,
      },
    }
  );
}
