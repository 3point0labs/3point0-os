import { createServerClient } from "@supabase/ssr";

export type DiscoveryFrequency = "daily" | "weekly";

export type AppSettings = {
  autoDiscovery: boolean;
  frequency: DiscoveryFrequency;
  contactsPerRun: 10 | 25;
  podcasts: Array<"One54" | "Pressbox Chronicles">;
  lastDiscoveryRunAt: string | null;
};

const defaultSettings: AppSettings = {
  autoDiscovery: false,
  frequency: "daily",
  contactsPerRun: 10,
  podcasts: ["One54", "Pressbox Chronicles"],
  lastDiscoveryRunAt: null,
};

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createServerClient(url, key, {
    cookies: { getAll: () => [], setAll: () => {} },
  });
}

export async function readSettings(): Promise<AppSettings> {
  try {
    const supabase = getServiceClient();
    const { data } = await supabase
      .from("app_settings")
      .select("*")
      .eq("key", "discovery")
      .maybeSingle();
    if (!data?.value) return { ...defaultSettings };
    const parsed = data.value as Partial<AppSettings>;
    return {
      ...defaultSettings,
      ...parsed,
      podcasts:
        Array.isArray(parsed.podcasts) && parsed.podcasts.length > 0
          ? parsed.podcasts.filter(
              (p) => p === "One54" || p === "Pressbox Chronicles"
            ) as AppSettings["podcasts"]
          : defaultSettings.podcasts,
    };
  } catch {
    return { ...defaultSettings };
  }
}

export async function writeSettings(settings: AppSettings): Promise<void> {
  const supabase = getServiceClient();
  await supabase.from("app_settings").upsert(
    { key: "discovery", value: settings },
    { onConflict: "key" }
  );
}