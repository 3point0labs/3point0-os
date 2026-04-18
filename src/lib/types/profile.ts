import type { CharacterConfig } from "@/lib/mailroom/config/characters"

export type UserRole = "admin" | "team" | "partner";

export type ViewMode = "classic" | "pixel";

export type Profile = {
  id: string;
  email: string | null;
  name: string | null;
  role: UserRole;
  podcast_access: string[];
  view_mode?: ViewMode;
  character_config?: CharacterConfig | null;
  gmail_connected?: boolean;
  created_at?: string;
};
