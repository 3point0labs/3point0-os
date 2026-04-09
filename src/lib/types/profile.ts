export type UserRole = "admin" | "team" | "partner";

export type Profile = {
  id: string;
  email: string | null;
  name: string | null;
  role: UserRole;
  podcast_access: string[];
  gmail_connected?: boolean;
  created_at?: string;
};
