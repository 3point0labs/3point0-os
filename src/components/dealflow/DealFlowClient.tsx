"use client"

import { useMemo, useState } from "react"
import {
  deleteDealFlowContact,
  saveDealFlowContact,
  saveDealFlowToPipeline,
  updateDealFlowStatus,
} from "@/app/actions/dealflow"
import type { DealFlowContact, DealFlowPodcast, DealFlowStatus, ScoutResult } from "@/lib/dealflow"
import { LogSection } from "./LogSection"
import { PitchSection } from "./PitchSection"
import { ScoutSection } from "./ScoutSection"

type Props = {
  initialContacts: DealFlowContact[]
}

export function DealFlowClient({ initialContacts }: Props) {
  const [contacts, setContacts] = useState(initialContacts)
  const [brand, setBrand] = useState("")
  const [podcast, setPodcast] = useState<DealFlowPodcast>("One54")
  const [scoutResult, setScoutResult] = useState<ScoutResult | null>(null)
  const [scouting, setScouting] = useState(false)
  const [pitching, setPitching] = useState(false)
  const [savingDraft, setSavingDraft] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [contactName, setContactName] = useState("")
  const [title, setTitle] = useState("")
  const [company, setCompany] = useState("")
  const [pitchAngle, setPitchAngle] = useState("")
  const [draft, setDraft] = useState("")
  const [channel, setChannel] = useState<"EMAIL" | "LINKEDIN DM" | null>(null)
  const [channelReason, setChannelReason] = useState("")

  const hasPitchIdentity = useMemo(
    () => contactName.trim() && company.trim(),
    [contactName, company]
  )

  const handleScout = async () => {
    setError(null)
    setScouting(true)
    const res = await fetch("/api/dealflow/scout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brand, podcast }),
    })
    const data = (await res.json()) as { error?: string; result?: ScoutResult }
    setScouting(false)
    if (!res.ok || !data.result) return setError(data.error ?? "Scout failed.")
    setScoutResult(data.result)
  }

  const handleUseScoutForPitch = () => {
    if (!scoutResult) return
    setContactName(scoutResult.name)
    setTitle(scoutResult.title)
    setCompany(scoutResult.company)
  }

  const handleGeneratePitch = async () => {
    setError(null)
    setPitching(true)
    const res = await fetch("/api/dealflow/pitch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactName, title, company, podcast, pitchAngle }),
    })
    const data = (await res.json()) as {
      error?: string
      result?: { recommended_channel: "EMAIL" | "LINKEDIN DM"; channel_reason: string; draft_message: string }
    }
    setPitching(false)
    if (!res.ok || !data.result) return setError(data.error ?? "Pitch generation failed.")
    setChannel(data.result.recommended_channel)
    setChannelReason(data.result.channel_reason)
    setDraft(data.result.draft_message)
  }

  const handleSaveDraft = async () => {
    setSavingDraft(true)
    const res = await saveDealFlowContact({
      brand: company,
      contactName,
      title,
      email: scoutResult?.email ?? "",
      linkedinUrl: scoutResult?.linkedin_url ?? "",
      podcast,
      pitchDraft: draft,
      channelRecommendation: channel ?? undefined,
      status: "Pitched",
    })
    setSavingDraft(false)
    if (!res.ok) return setError(res.error)
    const refreshed = await fetch("/api/dealflow/list").then((r) => r.json()).catch(() => null)
    if (refreshed?.contacts) setContacts(refreshed.contacts as DealFlowContact[])
  }

  return (
    <div className="space-y-4 lg:space-y-5">
      <ScoutSection
        brand={brand}
        podcast={podcast}
        scouting={scouting}
        error={error}
        result={scoutResult}
        onBrandChange={setBrand}
        onPodcastChange={setPodcast}
        onScout={() => void handleScout()}
        onDraftPitch={handleUseScoutForPitch}
        onSavePipeline={() => void (scoutResult ? saveDealFlowToPipeline({
          brand: scoutResult.company,
          contactName: scoutResult.name,
          title: scoutResult.title,
          email: scoutResult.email,
          linkedinUrl: scoutResult.linkedin_url,
          podcast,
        }) : Promise.resolve())}
      />

      <PitchSection
        contactName={contactName}
        title={title}
        company={company}
        podcast={podcast}
        pitchAngle={pitchAngle}
        draft={draft}
        channel={channel}
        channelReason={channelReason}
        generating={pitching}
        savingDraft={savingDraft}
        error={error}
        onContactNameChange={setContactName}
        onTitleChange={setTitle}
        onCompanyChange={setCompany}
        onPitchAngleChange={setPitchAngle}
        onGenerate={() => void (hasPitchIdentity ? handleGeneratePitch() : Promise.resolve())}
        onSaveDraft={() => void handleSaveDraft()}
        onDraftChange={setDraft}
      />

      <LogSection
        contacts={contacts}
        loading={false}
        error={error}
        onStatusChange={(id, status) => {
          void updateDealFlowStatus(id, status as DealFlowStatus).then((res) => {
            if (!res.ok) return setError(res.error)
            setContacts((prev) => prev.map((c) => (c.id === id ? { ...c, status } : c)))
          })
        }}
        onDelete={(id) => {
          void deleteDealFlowContact(id).then((res) => {
            if (!res.ok) return setError(res.error)
            setContacts((prev) => prev.filter((c) => c.id !== id))
          })
        }}
      />
    </div>
  )
}
