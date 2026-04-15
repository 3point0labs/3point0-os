export const DEALFLOW_STATUSES = [
  "New",
  "Pitched",
  "Followed Up",
  "In Convo",
  "Closed",
] as const

export const DEALFLOW_PODCASTS = ["One54", "Pressbox Chronicles", "BOTH"] as const

export type DealFlowStatus = (typeof DEALFLOW_STATUSES)[number]
export type DealFlowPodcast = (typeof DEALFLOW_PODCASTS)[number]

export type DealFlowConfidence = "HIGH" | "MEDIUM" | "LOW"
export type DealFlowChannel = "EMAIL" | "LINKEDIN DM"

export type DealFlowContact = {
  id: string
  brand: string
  contact_name: string
  title: string
  email: string
  linkedin_url: string
  podcast: DealFlowPodcast
  pitch_draft: string | null
  channel_recommendation: DealFlowChannel | null
  status: DealFlowStatus
  created_at: string
}

export type ScoutResult = {
  name: string
  title: string
  company: string
  email: string
  website_url: string
  linkedin_url: string
  confidence: DealFlowConfidence
  role_logic: string
}

export type PitchResult = {
  recommended_channel: DealFlowChannel
  channel_reason: string
  draft_message: string
}
