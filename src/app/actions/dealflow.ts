"use server"

import { randomUUID } from "crypto"
import { revalidatePath } from "next/cache"
import { createServerClient } from "@supabase/ssr"
import { assertPodcastAccess } from "@/lib/auth-server"
import type { DealFlowChannel, DealFlowContact, DealFlowPodcast, DealFlowStatus } from "@/lib/dealflow"

type SaveDealFlowInput = {
  id?: string
  brand: string
  contactName: string
  title: string
  email: string
  linkedinUrl: string
  podcast: DealFlowPodcast
  pitchDraft?: string
  channelRecommendation?: DealFlowChannel
  status?: DealFlowStatus
}

function getServiceClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  )
}

function toAccessPodcast(podcast: DealFlowPodcast): "One54" | "Pressbox Chronicles" {
  return podcast === "Pressbox Chronicles" ? "Pressbox Chronicles" : "One54"
}

export async function getDealFlowContacts(): Promise<DealFlowContact[]> {
  await assertPodcastAccess("One54")
  const supabase = getServiceClient()
  const { data, error } = await supabase
    .from("dealflow_contacts")
    .select("*")
    .order("created_at", { ascending: false })

  if (error) {
    console.error("[dealflow] getDealFlowContacts error", error)
    return []
  }

  return (data ?? []) as DealFlowContact[]
}

export async function saveDealFlowContact(input: SaveDealFlowInput): Promise<{ ok: true } | { ok: false; error: string }> {
  await assertPodcastAccess(toAccessPodcast(input.podcast))
  const supabase = getServiceClient()
  const { error } = await supabase.from("dealflow_contacts").upsert(
    {
      id: input.id ?? randomUUID(),
      brand: input.brand.trim(),
      contact_name: input.contactName.trim(),
      title: input.title.trim(),
      email: input.email.trim(),
      linkedin_url: input.linkedinUrl.trim(),
      podcast: input.podcast,
      pitch_draft: input.pitchDraft?.trim() || null,
      channel_recommendation: input.channelRecommendation ?? null,
      status: input.status ?? "New",
    },
    { onConflict: "id" }
  )

  if (error) return { ok: false, error: error.message }
  revalidatePath("/dealflow")
  return { ok: true }
}

export async function saveDealFlowToPipeline(input: SaveDealFlowInput): Promise<{ ok: true } | { ok: false; error: string }> {
  await assertPodcastAccess(toAccessPodcast(input.podcast))
  const supabase = getServiceClient()
  const podcast = input.podcast === "BOTH" ? "One54" : input.podcast
  const { error } = await supabase.from("sponsors").insert({
    id: `sp-${randomUUID().slice(0, 8)}`,
    company: input.brand.trim(),
    contact_name: input.contactName.trim(),
    contact_title: input.title.trim() || null,
    email: input.email.trim(),
    linkedin_url: input.linkedinUrl.trim() || null,
    podcast,
    stage: "New",
    last_contact_date: "",
    next_action: "DealFlow discovery outreach",
    notes: "Added from DealFlow Scout",
    pitch_angle: "",
  })
  if (error) return { ok: false, error: error.message }
  revalidatePath("/partnerships")
  revalidatePath("/dealflow")
  return { ok: true }
}

export async function updateDealFlowStatus(id: string, status: DealFlowStatus): Promise<{ ok: true } | { ok: false; error: string }> {
  await assertPodcastAccess("One54")
  const supabase = getServiceClient()
  const { error } = await supabase.from("dealflow_contacts").update({ status }).eq("id", id)
  if (error) return { ok: false, error: error.message }
  revalidatePath("/dealflow")
  return { ok: true }
}

export async function deleteDealFlowContact(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  await assertPodcastAccess("One54")
  const supabase = getServiceClient()
  const { error } = await supabase.from("dealflow_contacts").delete().eq("id", id)
  if (error) return { ok: false, error: error.message }
  revalidatePath("/dealflow")
  return { ok: true }
}
