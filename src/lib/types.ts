export const STAGES = [
  "New",
  "Contacted",
  "Followed Up",
  "Negotiating",
  "Closed",
] as const;

export const PODCASTS = ["Pressbox Chronicles", "One54"] as const;

export type Stage = (typeof STAGES)[number];
export type Podcast = (typeof PODCASTS)[number];

export type Sponsor = {
  id: string;
  contactName: string;
  company: string;
  email: string;
  linkedin_url?: string;
  company_linkedin?: string;
  company_twitter?: string;
  company_instagram?: string;
  youtubeUrl?: string;
  socialHandle?: string;
  pitch_angle?: string;
  category?: string;
  tier?: string;
  contact_title?: string;
  podcast: Podcast;
  stage: Stage;
  lastContactDate: string;
  nextAction: string;
  notes: string;
  scheduled_call_date?: string;
  gmail_thread_id?: string;
  last_reply_date?: string;
};

export type ClientHealthStatus = "strong" | "watch" | "at-risk";

export type ClientHealth = {
  id: string;
  name: string;
  status: ClientHealthStatus;
  score: number;
  note: string;
};

export type ContentOutput = {
  periodLabel: string;
  episodesPublished: number;
  episodesTarget: number;
  shortsClips: number;
  newsletterIssues: number;
  blogPosts: number;
};

export type DashboardData = {
  clientHealth: ClientHealth[];
  contentOutput: ContentOutput;
};
