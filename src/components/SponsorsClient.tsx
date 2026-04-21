"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { findBestContact } from "@/app/actions/find-contact";
import { draftOutreachEmail } from "@/app/actions/draft-email";
import { bulkEnrichPrioritySponsors } from "@/app/actions/enrich-contact";
import {
  addSponsor,
  checkSponsorReplies,
  importSponsorsFromCsv,
  moveSponsorStage,
  scheduleSponsorCall,
  updateSponsor,
} from "@/app/actions/sponsors";
import { SPONSOR_CATEGORIES } from "@/lib/categories";
import type { Sponsor, Stage } from "@/lib/types";
import { STAGES } from "@/lib/types";
import { DiscoverSponsorsModal } from "./DiscoverSponsorsModal";
import { DraftEmailModal } from "./DraftEmailModal";
import { usePodcastWorkspace } from "./PodcastWorkspaceProvider";
import { StageBadge } from "./StageBadge";
import { EmailBadge } from "./EmailBadge";

type DraftState = {
  open: boolean;
  title: string;
  body: string;
  toEmail: string;
  subject: string;
  recommendedChannel: string;
  channelReason: string;
  linkedinMessage: string | null;
  linkedinUrl: string | null;
  sponsorId: string;
  emailVerified?: boolean;
  emailSource?: string;
  emailValidationError?: string;
  attachDeck: boolean;
  loading: boolean;
  error: string | null;
};

type CsvPreviewRow = {
  company: string;
  contactName: string;
  email: string;
  linkedin_url: string;
  stage: string;
  notes: string;
  pitch_angle: string;
  category: string;
  tier: string;
  contact_title: string;
  podcast?: string;
};

type NewContactState = {
  company: string;
  contactName: string;
  contact_title: string;
  linkedin_url: string;
  email: string;
  category: string;
  tier: string;
  pitch_angle: string;
  notes: string;
};

type QuickEditState = {
  open: boolean;
  sponsorId: string;
  email: string;
  tier: string;
  category: string;
  pitch_angle: string;
};

type ScheduleState = {
  open: boolean;
  sponsorId: string;
  company: string;
  contactName: string;
  email: string;
  podcast: string;
  dateTimeLocal: string;
  durationMins: number;
};

const CATEGORIES = SPONSOR_CATEGORIES;

const initialDraft: DraftState = {
  open: false,
  title: "",
  body: "",
  toEmail: "",
  subject: "",
  recommendedChannel: "",
  channelReason: "",
  linkedinMessage: null,
  linkedinUrl: null,
  sponsorId: "",
  emailVerified: undefined,
  emailSource: undefined,
  emailValidationError: undefined,
  attachDeck: false,
  loading: false,
  error: null,
};

const emptyNewContact: NewContactState = {
  company: "",
  contactName: "",
  contact_title: "",
  linkedin_url: "",
  email: "",
  category: "Financial",
  tier: "B",
  pitch_angle: "",
  notes: "",
};

const initialQuickEdit: QuickEditState = {
  open: false,
  sponsorId: "",
  email: "",
  tier: "B",
  category: "Financial",
  pitch_angle: "",
};

const initialSchedule: ScheduleState = {
  open: false,
  sponsorId: "",
  company: "",
  contactName: "",
  email: "",
  podcast: "",
  dateTimeLocal: "",
  durationMins: 30,
};

function mapStatus(status: string) {
  const normalized = status.trim().toLowerCase();
  if (normalized === "not started") return "New";
  if (normalized === "in progress") return "Contacted";
  return status || "New";
}

/** Reverse of import mapping for CSV export */
function stageToExportStatus(stage: Stage): string {
  if (stage === "New") return "Not Started";
  if (stage === "Contacted") return "In Progress";
  return stage;
}

function escapeCsvCell(val: string): string {
  if (/[",\n\r]/.test(val)) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

const EXPORT_CSV_HEADERS = [
  "#",
  "Brand",
  "Category",
  "Tier",
  "Contact Name",
  "Title",
  "Email",
  "LinkedIn URL",
  "Pitch Angle",
  "Status",
  "Notes",
] as const;

function sponsorsToExportCsv(rows: Sponsor[]): string {
  const lines: string[] = [EXPORT_CSV_HEADERS.join(",")];
  rows.forEach((s, i) => {
    const cells = [
      String(i + 1),
      s.company,
      s.category ?? "",
      s.tier ?? "",
      s.contactName,
      s.contact_title ?? "",
      s.email,
      s.linkedin_url ?? "",
      s.pitch_angle ?? "",
      stageToExportStatus(s.stage),
      s.notes ?? "",
    ];
    lines.push(cells.map(escapeCsvCell).join(","));
  });
  return `\uFEFF${lines.join("\r\n")}`;
}

function downloadCsvFile(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function exportDateStamp(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === "," && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }
    if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && text[i + 1] === "\n") i += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    cell += ch;
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

function normalizeHeader(value: string) {
  return value.trim().toLowerCase();
}

function isNumericCell(value: string) {
  return /^\d+$/.test(value.trim());
}

function daysSince(dateStr: string) {
  if (!dateStr) return null;
  // Supabase returns either "YYYY-MM-DD" or a full ISO timestamp.
  // Normalize: if it looks like just a date, tack on T00:00:00; otherwise let Date parse it.
  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
  const then = new Date(isDateOnly ? dateStr + "T00:00:00" : dateStr);
  if (Number.isNaN(then.getTime())) return null;
  const diff = Date.now() - then.getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

function tierClass(tier?: string) {
  const t = (tier ?? "").trim().toUpperCase();
  if (t === "S")
    return "border-[rgba(201,168,124,0.5)] bg-[rgba(201,168,124,0.12)] text-[var(--color-accent-primary)]";
  if (t === "A") return "border-[rgba(232,83,61,0.4)] bg-[rgba(232,83,61,0.1)] text-[var(--color-accent-coral)]";
  return "border-[rgba(138,138,122,0.4)] bg-[rgba(138,138,122,0.1)] text-[var(--color-text-secondary)]";
}

function toGoogleCalendarDate(iso: string) {
  return iso.replaceAll("-", "").replaceAll(":", "").split(".")[0] + "Z";
}

function localInputDefault() {
  const dt = new Date();
  dt.setMinutes(dt.getMinutes() + 30);
  dt.setSeconds(0, 0);
  const pad = (v: number) => String(v).padStart(2, "0");
  const y = dt.getFullYear();
  const m = pad(dt.getMonth() + 1);
  const d = pad(dt.getDate());
  const hh = pad(dt.getHours());
  const mm = pad(dt.getMinutes());
  return `${y}-${m}-${d}T${hh}:${mm}`;
}

export type PartnershipsScopeFilter = "all" | "One54" | "Pressbox Chronicles";

export function SponsorsClient({
  initial,
  partnershipsScope,
}: {
  initial: Sponsor[];
  partnershipsScope?: PartnershipsScopeFilter;
}) {
  const router = useRouter();
  const [sponsors, setSponsors] = useState<Sponsor[]>(initial);
  const { activePodcast } = usePodcastWorkspace();

  useEffect(() => {
    setSponsors(initial);
  }, [initial]);
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [pending, startTransition] = useTransition();
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [discoverOpen, setDiscoverOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const [previewRows, setPreviewRows] = useState<CsvPreviewRow[]>([]);
  const [previewPodcast, setPreviewPodcast] = useState<"One54" | "Pressbox Chronicles">("One54");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<{
    imported: number;
    skipped: number;
  } | null>(null);
  const [isEnrichingImport, setIsEnrichingImport] = useState(false);

  const [newOpen, setNewOpen] = useState(false);
  const [newForm, setNewForm] = useState<NewContactState>(emptyNewContact);
  const [findLoading, setFindLoading] = useState(false);
  const [findError, setFindError] = useState<string | null>(null);
  const [findRationale, setFindRationale] = useState<string>("");
  const [quickEdit, setQuickEdit] = useState<QuickEditState>(initialQuickEdit);
  const [schedule, setSchedule] = useState<ScheduleState>(initialSchedule);
  const [replyCheckResult, setReplyCheckResult] = useState<string>("");
  const [enrichResult, setEnrichResult] = useState<string>("");
  const [enrichingBulk, setEnrichingBulk] = useState(false);
  const [draft, setDraft] = useState<DraftState>(initialDraft);

  const openDraft = useCallback((sponsor: Sponsor) => {
    setDraft({
      open: true,
      title: `${sponsor.contactName} · ${sponsor.company}`,
      body: "",
      toEmail: sponsor.email,
      subject: `${sponsor.company} x ${sponsor.podcast} sponsorship`,
      recommendedChannel: "",
      channelReason: "",
      linkedinMessage: null,
      linkedinUrl: null,
      sponsorId: sponsor.id,
      emailVerified: sponsor.email_verified,
      emailSource: sponsor.email_source,
      emailValidationError: sponsor.email_validation_error,
      attachDeck: false,
      loading: true,
      error: null,
    });
    void draftOutreachEmail(sponsor.id).then((result) => {
      setDraft((d) =>
        result.ok
          ? {
              ...d,
              loading: false,
              body: result.email,
              recommendedChannel: result.recommendedChannel,
              channelReason: result.reason,
              linkedinMessage: result.linkedinMessage,
              linkedinUrl: result.linkedinUrl,
              error: null,
            }
          : { ...d, loading: false, body: "", error: result.error }
      );
    });
  }, []);

  const onPickCsv = useCallback(async (file: File) => {
    setImportError(null);
    try {
      const text = await file.text();
      const parsed = parseCsv(text).filter((r) =>
        r.some((c) => c.trim().length > 0)
      );
      if (parsed.length < 2) {
        setImportError("CSV must include a header row and data rows.");
        return;
      }

      const headerRowIndex = parsed.findIndex((row) => {
        const normalized = row.map(normalizeHeader);
        return (
          normalized.includes("brand") ||
          normalized.includes("company")
        );
      });
      if (headerRowIndex === -1) {
        setImportError("Could not detect CSV header row (Brand/Company missing).");
        return;
      }

      const headers = parsed[headerRowIndex].map(normalizeHeader);
      const findAny = (...names: string[]) =>
        headers.findIndex((h) => names.includes(h));
      const index = {
        rowNum: findAny("#", "no", "number"),
        company: findAny("brand", "company"),
        contactName: findAny("contact name", "contactname"),
        email: findAny("email"),
        linkedin: findAny("linkedin url", "linkedin", "linkedin_url"),
        status: findAny("status"),
        notes: findAny("notes"),
        pitch: findAny("pitch angle", "pitch_angle"),
        category: findAny("category"),
        tier: findAny("tier"),
        title: findAny("title"),
        podcast: findAny("podcast"),
      };
      const required = [index.company, index.contactName, index.email, index.status];
      if (required.some((v) => v === -1)) {
        setImportError("CSV headers do not match the expected format.");
        return;
      }

      const dataRows = parsed
        .slice(headerRowIndex + 1)
        .filter((r) => {
          if (index.rowNum >= 0) return isNumericCell(r[index.rowNum] ?? "");
          return isNumericCell(r[0] ?? "");
        });

      const mapped: CsvPreviewRow[] = dataRows.map((r) => ({
        company: (r[index.company] ?? "").trim(),
        contactName: (r[index.contactName] ?? "").trim(),
        email: (r[index.email] ?? "").trim(),
        linkedin_url: index.linkedin >= 0 ? (r[index.linkedin] ?? "").trim() : "",
        stage: mapStatus((r[index.status] ?? "").trim()),
        notes: index.notes >= 0 ? (r[index.notes] ?? "").trim() : "",
        pitch_angle: index.pitch >= 0 ? (r[index.pitch] ?? "").trim() : "",
        category: index.category >= 0 ? (r[index.category] ?? "").trim() : "",
        tier: index.tier >= 0 ? (r[index.tier] ?? "").trim() : "",
        contact_title: index.title >= 0 ? (r[index.title] ?? "").trim() : "",
        podcast:
          index.podcast >= 0 ? (r[index.podcast] ?? "").trim() : activePodcast,
      }));

      const valid = mapped.filter((r) => r.company && r.contactName);
      if (valid.length === 0) {
        setImportError("No valid contacts found (need Brand and Contact Name).");
        return;
      }
      setPreviewRows(valid);
      setPreviewPodcast(activePodcast);
      setPreviewOpen(true);
      setImportResult(null);
    } catch {
      setImportError("Failed to parse CSV.");
    }
  }, [activePodcast]);

  const scopedSponsors = useMemo(() => {
    if (partnershipsScope === "all") return sponsors;
    if (partnershipsScope === "One54") return sponsors.filter((s) => s.podcast === "One54");
    if (partnershipsScope === "Pressbox Chronicles") {
      return sponsors.filter((s) => s.podcast === "Pressbox Chronicles");
    }
    return sponsors.filter((s) => s.podcast === activePodcast);
  }, [sponsors, partnershipsScope, activePodcast]);

  const filteredByCategory = useMemo(() => {
    if (activeCategory === "All") return scopedSponsors;
    return scopedSponsors.filter((s) => (s.category ?? "") === activeCategory);
  }, [activeCategory, scopedSponsors]);

  const filteredBySearch = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return filteredByCategory;
    return filteredByCategory.filter((s) => {
      const company = (s.company ?? "").toLowerCase();
      const contact = (s.contactName ?? "").toLowerCase();
      return company.includes(q) || contact.includes(q);
    });
  }, [filteredByCategory, searchQuery]);

  const grouped = useMemo(() => {
    
    const map: Record<Stage, Sponsor[]> = {
      New: [],
      Contacted: [],
      "Followed Up": [],
      Negotiating: [],
      Closed: [],
    };
    for (const sponsor of filteredBySearch) {
      map[sponsor.stage].push(sponsor);
    }
    return map;
  }, [filteredBySearch]);

  return (
    <div className="space-y-5">
      <DraftEmailModal
        open={draft.open}
        onClose={() => {
          setDraft(initialDraft);
          router.refresh();
        }}
        title={draft.title}
        body={draft.body}
        toEmail={draft.toEmail}
        subject={draft.subject}
        recommendedChannel={draft.recommendedChannel}
        channelReason={draft.channelReason}
        linkedinMessage={draft.linkedinMessage}
        linkedinUrl={draft.linkedinUrl}
        sponsorId={draft.sponsorId}
        emailVerified={draft.emailVerified}
        emailSource={draft.emailSource}
        emailValidationError={draft.emailValidationError}
        attachDeck={draft.attachDeck}
        onToggleAttachDeck={(value) =>
          setDraft((d) => ({ ...d, attachDeck: value }))
        }
        loading={draft.loading}
        error={draft.error}
      />

      <ScheduleCallModal
        open={schedule.open}
        data={schedule}
        onClose={() => setSchedule(initialSchedule)}
        onChange={(next) => setSchedule((s) => ({ ...s, ...next }))}
        onConfirm={() =>
          startTransition(() => {
            if (!schedule.dateTimeLocal) return
            const start = new Date(schedule.dateTimeLocal)
            const end = new Date(start.getTime() + schedule.durationMins * 60 * 1000)
            const startIso = start.toISOString()
            const endIso = end.toISOString()
            const text = `Sponsor call — ${schedule.company}`
            const details = `${schedule.contactName} · ${schedule.email}\nPodcast: ${schedule.podcast}`
            const url =
              "https://calendar.google.com/calendar/render?action=TEMPLATE" +
              `&text=${encodeURIComponent(text)}` +
              `&details=${encodeURIComponent(details)}` +
              `&dates=${toGoogleCalendarDate(startIso)}/${toGoogleCalendarDate(endIso)}`
            window.open(url, "_blank", "noopener,noreferrer")
            void scheduleSponsorCall(schedule.sponsorId, startIso).then((res) => {
              if (!res.ok) return
              setSponsors((prev) =>
                prev.map((s) => (s.id === schedule.sponsorId ? { ...s, scheduled_call_date: startIso } : s))
              )
              setSchedule(initialSchedule)
              router.refresh()
            })
          })
        }
        pending={pending}
      />

      <CsvImportModal
        open={previewOpen}
        rows={previewRows}
        previewPodcast={previewPodcast}
        onClose={() => setPreviewOpen(false)}
        onConfirm={() =>
          startTransition(() => {
            setIsEnrichingImport(true);
            void importSponsorsFromCsv(previewRows, previewPodcast).then((res) => {
              if (res.ok) {
                setImportResult({ imported: res.imported, skipped: res.skipped });
                router.refresh();
              }
              setIsEnrichingImport(false);
              setPreviewOpen(false);
              setPreviewRows([]);
            });
          })
        }
        pending={pending}
      />

      <NewContactModal
        open={newOpen}
        form={newForm}
        setForm={setNewForm}
        onClose={() => {
          setNewOpen(false);
          setFindError(null);
          setFindRationale("");
        }}
        findLoading={findLoading}
        findError={findError}
        findRationale={findRationale}
        onFindContact={() => {
          setFindError(null);
          setFindRationale("");
          if (!newForm.company.trim()) {
            setFindError("Enter a company name first.");
            return;
          }
          setFindLoading(true);
          void findBestContact(newForm.company).then((res) => {
            setFindLoading(false);
            if (!res.ok) {
              setFindError(res.error);
              return;
            }
            setNewForm((prev) => ({
              ...prev,
              contactName: res.contactName || prev.contactName,
              contact_title: res.contactTitle || prev.contact_title,
              linkedin_url: res.linkedinUrl || prev.linkedin_url,
            }));
            setFindRationale(res.rationale);
          });
        }}
        onSave={() =>
          startTransition(() => {
            const fd = new FormData();
            fd.set("company", newForm.company);
            fd.set("contactName", newForm.contactName);
            fd.set("contact_title", newForm.contact_title);
            fd.set("linkedin_url", newForm.linkedin_url);
            fd.set("email", newForm.email);
            fd.set("category", newForm.category);
            fd.set("tier", newForm.tier);
            fd.set("pitch_angle", newForm.pitch_angle);
            fd.set("notes", newForm.notes);
            fd.set("podcast", activePodcast);
            fd.set("stage", "New");
            void addSponsor(fd).then((res) => {
              if (res.ok) {
                setNewOpen(false);
                setNewForm(emptyNewContact);
                setFindRationale("");
                router.refresh();
              }
            });
          })
        }
        pending={pending}
      />

      <DiscoverSponsorsModal
        open={discoverOpen}
        onClose={() => setDiscoverOpen(false)}
        onAdded={() => router.refresh()}
      />

      <QuickEditModal
        open={quickEdit.open}
        data={quickEdit}
        setData={setQuickEdit}
        onClose={() => setQuickEdit(initialQuickEdit)}
        onSave={() =>
          startTransition(() => {
            const fd = new FormData();
            fd.set("id", quickEdit.sponsorId);
            fd.set("email", quickEdit.email);
            fd.set("tier", quickEdit.tier);
            fd.set("category", quickEdit.category);
            fd.set("pitch_angle", quickEdit.pitch_angle);
            void updateSponsor(fd).then((res) => {
              if (!res.ok) return;
              setSponsors((prev) =>
                prev.map((s) =>
                  s.id === quickEdit.sponsorId
                    ? {
                        ...s,
                        email: quickEdit.email,
                        tier: quickEdit.tier,
                        category: quickEdit.category,
                        pitch_angle: quickEdit.pitch_angle,
                      }
                    : s
                )
              );
              setQuickEdit(initialQuickEdit);
              router.refresh();
            });
          })
        }
        pending={pending}
      />

      <section className="mission-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <svg
                className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-secondary)]"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden
              >
                <circle cx="11" cy="11" r="7" />
                <path d="m21 21-4.3-4.3" strokeLinecap="round" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search company or contact..."
                className="min-h-9 w-64 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-primary)] pl-8 pr-7 py-1.5 font-mono text-xs text-[var(--color-accent-eggshell)] outline-none placeholder:text-[var(--color-text-secondary)] focus:border-[rgba(201,168,124,0.5)]"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  aria-label="Clear search"
                  className="absolute right-1.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded text-[var(--color-text-secondary)] hover:bg-[rgba(139,69,19,0.12)] hover:text-[var(--color-accent-eggshell)]"
                >
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
            <CategoryTab
              active={activeCategory === "All"}
              onClick={() => setActiveCategory("All")}
            >
              All
            </CategoryTab>
            {CATEGORIES.map((category) => (
              <CategoryTab
                key={category}
                active={activeCategory === category}
                onClick={() => setActiveCategory(category)}
              >
                {category}
              </CategoryTab>
            ))}
          </div>
          <div className="flex w-full flex-col gap-2 lg:w-auto lg:flex-row lg:flex-wrap">
            <button
              type="button"
              onClick={() =>
                startTransition(() => {
                  setReplyCheckResult("Checking Gmail replies...");
                  void checkSponsorReplies().then((res) => {
                    if (!res.ok) {
                      setReplyCheckResult(res.error);
                      return;
                    }
                    setReplyCheckResult(`Checked ${res.checked} contacts, matched ${res.matched} replies`);
                    router.refresh();
                  });
                })
              }
              className="min-h-11 w-full rounded-lg border border-[rgba(0,212,170,0.45)] bg-[rgba(0,212,170,0.12)] px-3 py-2 font-mono text-xs uppercase tracking-wider text-[#00d4aa] hover:bg-[rgba(0,212,170,0.2)] lg:w-auto lg:min-h-0 lg:py-1.5"
            >
              ↻ Check replies
            </button>
            <button
              type="button"
              onClick={() => setDiscoverOpen(true)}
              className="min-h-11 w-full rounded-lg border border-[var(--color-border-strong)] bg-transparent px-3 py-2 font-mono text-xs uppercase tracking-wider text-[var(--color-accent-primary)] hover:bg-[rgba(201,168,124,0.08)] lg:w-auto lg:min-h-0 lg:py-1.5"
            ><button
            type="button"
            disabled={enrichingBulk}
            onClick={() => {
              if (enrichingBulk) return;
              const confirmed = window.confirm(
                "Verify all Tier S + A emails via RocketReach?\n\nThis costs ~1 search + 1 lookup credit per sponsor (~50 total). Verified sponsors are skipped automatically."
              );
              if (!confirmed) return;

              setEnrichingBulk(true);
              setEnrichResult("Enriching priority sponsors via RocketReach...");
              startTransition(() => {
                void bulkEnrichPrioritySponsors({
                  tiers: ["S", "A"],
                  minCreditsRemaining: 50,
                }).then((res) => {
                  setEnrichingBulk(false);
                  if (!res.ok) {
                    setEnrichResult(`Bulk enrich failed: ${res.error}`);
                    return;
                  }
                  if (res.stoppedEarly && res.reason) {
                    setEnrichResult(`Stopped: ${res.reason}`);
                    return;
                  }
                  const parts = [
                    `Enriched ${res.enriched}`,
                    `skipped ${res.skipped}`,
                    `failed ${res.failed}`,
                    `${res.creditsUsedTotal} credits used`,
                  ];
                  if (res.personLookupRemainingAfter !== null) {
                    parts.push(`${res.personLookupRemainingAfter} lookups left`);
                  }
                  setEnrichResult(parts.join(" · "));
                  router.refresh();
                });
              });
            }}
            className="min-h-11 w-full rounded-lg border border-[rgba(0,212,170,0.45)] bg-[rgba(0,212,170,0.12)] px-3 py-2 font-mono text-xs uppercase tracking-wider text-[#00d4aa] hover:bg-[rgba(0,212,170,0.2)] disabled:cursor-not-allowed disabled:opacity-50 lg:w-auto lg:min-h-0 lg:py-1.5"
          >
            {enrichingBulk ? "Verifying..." : "✓ Verify Tier S+A emails"}
          </button>
              Discover new sponsors
            </button>
            <label className="flex min-h-11 w-full cursor-pointer items-center justify-center rounded-lg border border-[rgba(232,83,61,0.45)] bg-[rgba(232,83,61,0.12)] px-3 py-2 font-mono text-xs uppercase tracking-wider text-[var(--color-accent-coral)] hover:bg-[rgba(232,83,61,0.18)] lg:w-auto lg:min-h-0 lg:py-1.5">
              Import CSV
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void onPickCsv(f);
                  e.currentTarget.value = "";
                }}
              />
            </label>
            <button
              type="button"
              onClick={() => {
                const list = sponsors.filter((s) => s.podcast === "One54");
                downloadCsvFile(
                  `One54_Sponsors_${exportDateStamp()}.csv`,
                  sponsorsToExportCsv(list)
                );
              }}
              className="min-h-11 w-full rounded-lg border border-[var(--color-border)] bg-transparent px-3 py-2 font-mono text-xs uppercase tracking-wider text-[var(--color-accent-primary)] hover:bg-[rgba(201,168,124,0.06)] lg:w-auto lg:min-h-0 lg:py-1.5"
            >
              Export One54 CSV
            </button>
            <button
              type="button"
              onClick={() => {
                const list = sponsors.filter((s) => s.podcast === "Pressbox Chronicles");
                downloadCsvFile(
                  `PBC_Sponsors_${exportDateStamp()}.csv`,
                  sponsorsToExportCsv(list)
                );
              }}
              className="min-h-11 w-full rounded-lg border border-[var(--color-border)] bg-transparent px-3 py-2 font-mono text-xs uppercase tracking-wider text-[var(--color-accent-primary)] hover:bg-[rgba(201,168,124,0.06)] lg:w-auto lg:min-h-0 lg:py-1.5"
            >
              Export Pressbox CSV
            </button>
            <button
              type="button"
              onClick={() => setNewOpen(true)}
              className="min-h-11 w-full rounded-lg border border-[var(--color-border-strong)] bg-[rgba(201,168,124,0.08)] px-3 py-2 font-mono text-xs uppercase tracking-wider text-[var(--color-accent-primary)] hover:bg-[rgba(201,168,124,0.14)] lg:w-auto lg:min-h-0 lg:py-1.5"
            >
              + New contact
            </button>
          </div>
        </div>

        {importError && <p className="mt-3 text-xs text-red-300">{importError}</p>}
        {replyCheckResult && <p className="mt-3 text-xs text-[var(--color-text-secondary)]">{replyCheckResult}</p>}
        {enrichResult && <p className="mt-3 text-xs text-[var(--color-text-secondary)]">{enrichResult}</p>}
        {importResult && (
          <p className="mt-3 text-xs text-[var(--color-text-secondary)]">
            Import complete:{" "}
            <span className="text-[var(--color-accent-primary)]">{importResult.imported} imported</span> ·{" "}
            <span className="text-[var(--color-accent-coral)]">{importResult.skipped} skipped</span>
          </p>
        )}
        {isEnrichingImport && (
          <p className="mt-2 font-mono text-xs uppercase tracking-wider text-[var(--color-accent-coral)]">
            Enriching contacts...
          </p>
        )}
      </section>

      <section className="flex gap-3 overflow-x-auto overflow-y-visible pb-2 [-webkit-overflow-scrolling:touch] snap-x snap-mandatory lg:grid lg:grid-cols-5 lg:overflow-visible lg:pb-0">
        {STAGES.map((stage) => (
          <div
            key={stage}
            className="mission-card w-[min(100%,calc(100vw-2rem))] shrink-0 snap-center p-3 min-h-[420px] lg:min-h-[500px] lg:w-auto lg:shrink lg:snap-none"
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (!draggingId) return;
              const sponsorId = draggingId; // capture before clearing
              const old = sponsors;
              
              setSponsors((prev) =>
                prev.map((s) => (s.id === sponsorId ? { ...s, stage } : s))
              );
              setDraggingId(null);
              
              startTransition(() => {
                void moveSponsorStage(sponsorId, stage).then((res) => {
                  if (!res.ok) {
                    setSponsors(old);
                  } else {
                    router.refresh();
                  }
                });
              });
            }}
          >
            <div className="mb-3 flex items-center justify-between border-b border-[var(--color-border)] pb-2">
              <StageBadge stage={stage} />
              <span className="font-mono text-[11px] text-[var(--color-text-secondary)]">
                {grouped[stage].length}
              </span>
            </div>
            <div className="space-y-2">
              {grouped[stage].map((s) => {
                const elapsed = mounted ? daysSince(s.lastContactDate) : null;
                return (
                  <article
                    key={s.id}
                    draggable
                    onDragStart={() => setDraggingId(s.id)}
                    className="glass-card rounded-lg p-3"
                  >
                    <p className="font-semibold text-[var(--color-accent-eggshell)]">{s.company}</p>
                    <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
                      {s.contactName}
                      {s.contact_title ? ` · ${s.contact_title}` : ""}
                    </p>
                    <div className="mt-1.5">
                      <EmailBadge sponsor={s} />
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span
                        className={`rounded-md border px-2 py-0.5 font-mono text-[10px] uppercase ${tierClass(
                          s.tier
                        )}`}
                      >
                        Tier {s.tier || "B"}
                      </span>
                      <span
                        className={`font-mono text-[10px] ${
                          elapsed !== null && elapsed > 7
                            ? "text-[var(--color-accent-coral)]"
                            : "text-[var(--color-text-secondary)]"
                        }`}
                      >
                        {!mounted ? "—" : elapsed === null ? "No contact" : `${elapsed}d since touch`}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {s.linkedin_url && (
                        <a
                          href={s.linkedin_url}
                          target="_blank"
                          rel="noreferrer"
                          className="min-h-9 rounded border border-[var(--color-border)] px-2 py-1.5 font-mono text-[10px] text-[var(--color-accent-primary)]"
                          title="Contact LinkedIn"
                        >
                          in
                        </a>
                      )}
                      {s.company_linkedin && (
                        <a
                          href={s.company_linkedin}
                          target="_blank"
                          rel="noreferrer"
                          className="min-h-9 rounded border border-[var(--color-border)] px-2 py-1.5 font-mono text-[10px] text-[var(--color-accent-primary)]"
                          title="Company LinkedIn"
                        >
                          c-in
                        </a>
                      )}
                      {s.company_twitter && (
                        <a
                          href={s.company_twitter}
                          target="_blank"
                          rel="noreferrer"
                          className="min-h-9 rounded border border-[var(--color-border)] px-2 py-1.5 font-mono text-[10px] text-[var(--color-accent-primary)]"
                          title="Company X/Twitter"
                        >
                          X
                        </a>
                      )}
                      {s.company_instagram && (
                        <a
                          href={s.company_instagram}
                          target="_blank"
                          rel="noreferrer"
                          className="min-h-9 rounded border border-[var(--color-border)] px-2 py-1.5 font-mono text-[10px] text-[var(--color-accent-primary)]"
                          title="Company Instagram"
                        >
                          IG
                        </a>
                      )}
                    </div>
                    <button type="button" onClick={() => openDraft(s)} className="btn-cta mt-3 w-full">
                      &gt; RUN AGENT
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setSchedule({
                          open: true,
                          sponsorId: s.id,
                          company: s.company,
                          contactName: s.contactName,
                          email: s.email,
                          podcast: s.podcast,
                          dateTimeLocal: localInputDefault(),
                          durationMins: 30,
                        })
                      }
                      className="mt-2 min-h-11 w-full rounded-md border border-[rgba(201,168,124,0.45)] bg-[rgba(201,168,124,0.1)] py-2 font-mono text-[10px] uppercase tracking-wider text-[var(--color-accent-primary)] hover:bg-[rgba(201,168,124,0.2)]"
                    >
                      📅 Schedule call
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setQuickEdit({
                          open: true,
                          sponsorId: s.id,
                          email: s.email ?? "",
                          tier: s.tier ?? "B",
                          category: s.category ?? "Financial",
                          pitch_angle: s.pitch_angle ?? "",
                        })
                      }
                      className="mt-2 min-h-11 w-full rounded-md border border-[var(--color-border-strong)] bg-[rgba(201,168,124,0.08)] py-2 font-mono text-[10px] uppercase tracking-wider text-[var(--color-accent-primary)] hover:bg-[rgba(201,168,124,0.14)]"
                    >
                      Quick edit
                    </button>
                  </article>
                );
              })}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}

function CategoryTab({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-9 rounded-md border px-2.5 py-2 font-mono text-[10px] uppercase tracking-wider transition lg:min-h-0 lg:py-1 ${
        active
          ? "border-[rgba(201,168,124,0.5)] bg-[rgba(201,168,124,0.12)] text-[var(--color-accent-primary)]"
          : "border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-accent-eggshell)]"
      }`}
    >
      {children}
    </button>
  );
}

function NewContactModal({
  open,
  form,
  setForm,
  onClose,
  onFindContact,
  onSave,
  pending,
  findLoading,
  findError,
  findRationale,
}: {
  open: boolean;
  form: NewContactState;
  setForm: React.Dispatch<React.SetStateAction<NewContactState>>;
  onClose: () => void;
  onFindContact: () => void;
  onSave: () => void;
  pending: boolean;
  findLoading: boolean;
  findError: string | null;
  findRationale: string;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="glass-card relative z-10 w-full max-w-xl rounded-xl p-4">
        <h3 className="font-mono text-sm uppercase tracking-[0.2em] text-[var(--color-accent-eggshell)]">
          New Contact
        </h3>

        <div className="glass-card mt-3 rounded-lg p-3">
          <p className="font-mono text-[11px] uppercase tracking-wider text-[var(--color-text-secondary)]">
            Agentic contact finder
          </p>
          <div className="mt-2 flex gap-2">
            <input
              value={form.company}
              onChange={(e) => setForm((p) => ({ ...p, company: e.target.value }))}
              placeholder="Company name"
              className={inputClass}
            />
            <button
              type="button"
              onClick={onFindContact}
              disabled={findLoading}
              className="min-h-11 rounded-md border border-[var(--color-border-strong)] bg-[rgba(201,168,124,0.1)] px-3 font-mono text-[11px] uppercase tracking-wider text-[var(--color-accent-primary)]"
            >
              {findLoading ? "Searching..." : "Find contact"}
            </button>
          </div>
          {findError && <p className="mt-2 text-xs text-red-300">{findError}</p>}
          {findRationale && <p className="mt-2 text-xs text-[var(--color-text-secondary)]">{findRationale}</p>}
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <input className={inputClass} placeholder="Contact name" value={form.contactName} onChange={(e) => setForm((p) => ({ ...p, contactName: e.target.value }))} />
          <input className={inputClass} placeholder="Title" value={form.contact_title} onChange={(e) => setForm((p) => ({ ...p, contact_title: e.target.value }))} />
          <input className={inputClass} placeholder="LinkedIn URL" value={form.linkedin_url} onChange={(e) => setForm((p) => ({ ...p, linkedin_url: e.target.value }))} />
          <input className={inputClass} placeholder="Email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
          <select className={inputClass} value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select className={inputClass} value={form.tier} onChange={(e) => setForm((p) => ({ ...p, tier: e.target.value }))}>
            <option value="S">S</option>
            <option value="A">A</option>
            <option value="B">B</option>
          </select>
          <input className={`${inputClass} sm:col-span-2`} placeholder="Pitch angle" value={form.pitch_angle} onChange={(e) => setForm((p) => ({ ...p, pitch_angle: e.target.value }))} />
          <textarea className={`${inputClass} sm:col-span-2`} rows={2} placeholder="Notes" value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} />
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="min-h-11 rounded-md border border-[var(--color-border)] px-3 py-2 font-mono text-xs text-[var(--color-text-secondary)] lg:min-h-0 lg:py-1.5">Cancel</button>
          <button onClick={onSave} disabled={pending || !form.company || !form.contactName} className="btn-cta min-h-11 px-3 py-2 text-xs lg:min-h-0 lg:py-1.5 disabled:opacity-50">Save</button>
        </div>
      </div>
    </div>
  );
}

function QuickEditModal({
  open,
  data,
  setData,
  onClose,
  onSave,
  pending,
}: {
  open: boolean;
  data: QuickEditState;
  setData: React.Dispatch<React.SetStateAction<QuickEditState>>;
  onClose: () => void;
  onSave: () => void;
  pending: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="glass-card relative z-10 w-full max-w-lg rounded-xl p-4">
        <h3 className="font-mono text-sm uppercase tracking-[0.2em] text-[var(--color-accent-eggshell)]">
          Quick Edit Contact
        </h3>
        <div className="mt-3 grid gap-2">
          <input
            className={inputClass}
            placeholder="Email"
            value={data.email}
            onChange={(e) => setData((p) => ({ ...p, email: e.target.value }))}
          />
          <div className="grid gap-2 sm:grid-cols-2">
            <select
              className={inputClass}
              value={data.tier}
              onChange={(e) => setData((p) => ({ ...p, tier: e.target.value }))}
            >
              <option value="S">S</option>
              <option value="A">A</option>
              <option value="B">B</option>
            </select>
            <select
              className={inputClass}
              value={data.category}
              onChange={(e) =>
                setData((p) => ({ ...p, category: e.target.value }))
              }
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <textarea
            className={inputClass}
            rows={3}
            placeholder="Pitch angle"
            value={data.pitch_angle}
            onChange={(e) =>
              setData((p) => ({ ...p, pitch_angle: e.target.value }))
            }
          />
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="min-h-11 rounded-md border border-[var(--color-border)] px-3 py-2 font-mono text-xs text-[var(--color-text-secondary)] lg:min-h-0 lg:py-1.5"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={pending}
            className="btn-cta min-h-11 px-3 py-2 text-xs lg:min-h-0 lg:py-1.5 disabled:opacity-50"
          >
            Save changes
          </button>
        </div>
      </div>
    </div>
  );
}

function ScheduleCallModal({
  open,
  data,
  onClose,
  onChange,
  onConfirm,
  pending,
}: {
  open: boolean
  data: ScheduleState
  onClose: () => void
  onChange: (next: Partial<ScheduleState>) => void
  onConfirm: () => void
  pending: boolean
}) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="glass-card relative z-10 w-full max-w-lg rounded-xl p-4">
        <h3 className="font-mono text-sm uppercase tracking-[0.2em] text-[var(--color-accent-eggshell)]">
          Schedule Sponsor Call
        </h3>
        <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
          {data.company} · {data.contactName}
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <input
            type="datetime-local"
            className={inputClass}
            value={data.dateTimeLocal}
            onChange={(e) => onChange({ dateTimeLocal: e.target.value })}
          />
          <select
            className={inputClass}
            value={data.durationMins}
            onChange={(e) => onChange({ durationMins: Number(e.target.value) })}
          >
            <option value={30}>30 min</option>
            <option value={45}>45 min</option>
            <option value={60}>60 min</option>
          </select>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="min-h-11 rounded-md border border-[var(--color-border)] px-3 py-2 font-mono text-xs text-[var(--color-text-secondary)] lg:min-h-0 lg:py-1.5"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={pending || !data.dateTimeLocal}
            className="min-h-11 rounded-md border border-[rgba(201,168,124,0.45)] bg-[rgba(201,168,124,0.1)] px-3 py-2 font-mono text-xs uppercase tracking-wider text-[var(--color-accent-primary)] hover:bg-[rgba(201,168,124,0.2)] disabled:opacity-50 lg:min-h-0 lg:py-1.5"
          >
            Create calendar draft
          </button>
        </div>
      </div>
    </div>
  )
}

const inputClass =
  "min-h-11 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-2.5 py-2 text-sm text-[var(--color-accent-eggshell)] outline-none placeholder:text-[var(--color-text-secondary)]";

function CsvImportModal({
  open,
  rows,
  previewPodcast,
  onClose,
  onConfirm,
  pending,
}: {
  open: boolean;
  rows: CsvPreviewRow[];
  previewPodcast: "One54" | "Pressbox Chronicles";
  onClose: () => void;
  onConfirm: () => void;
  pending: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
      />
      <div className="glass-card relative z-10 w-full max-w-6xl overflow-hidden rounded-xl">
        <div className="border-b border-[var(--color-border)] px-5 py-4">
          <h3 className="font-mono text-lg text-[var(--color-accent-eggshell)]">CSV Preview</h3>
          <p className="text-xs text-[var(--color-text-secondary)]">
            {rows.length} contacts will be imported to {previewPodcast}.
          </p>
        </div>
        <div className="max-h-[60vh] overflow-auto">
          <table className="w-full min-w-[1100px] text-left text-xs">
            <thead className="font-mono uppercase tracking-wider text-[var(--color-text-secondary)]">
              <tr className="border-b border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-bg-secondary)_55%,transparent)] backdrop-blur-sm">
                <th className="px-3 py-2">Company</th>
                <th className="px-3 py-2">Contact</th>
                <th className="px-3 py-2">Title</th>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">LinkedIn URL</th>
                <th className="px-3 py-2">Stage</th>
                <th className="px-3 py-2">Pitch angle</th>
                <th className="px-3 py-2">Category</th>
                <th className="px-3 py-2">Tier</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {rows.map((r, idx) => (
                <tr key={`${r.company}-${r.contactName}-${idx}`} className="text-[color-mix(in_srgb,var(--color-accent-eggshell)_88%,transparent)]">
                  <td className="px-3 py-2">{r.company}</td>
                  <td className="px-3 py-2">{r.contactName}</td>
                  <td className="px-3 py-2">{r.contact_title}</td>
                  <td className="px-3 py-2">{r.email}</td>
                  <td className="px-3 py-2">{r.linkedin_url || "-"}</td>
                  <td className="px-3 py-2">{r.stage}</td>
                  <td className="max-w-[380px] truncate px-3 py-2">{r.pitch_angle}</td>
                  <td className="px-3 py-2">{r.category}</td>
                  <td className="px-3 py-2">{r.tier}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex justify-end gap-2 border-t border-[var(--color-border)] px-5 py-4">
          <button onClick={onClose} className="min-h-11 rounded-md border border-[var(--color-border)] px-3 py-2 font-mono text-xs text-[var(--color-text-secondary)] lg:min-h-0 lg:py-1.5">Cancel</button>
          <button onClick={onConfirm} disabled={pending} className="btn-cta min-h-11 px-3 py-2 text-xs lg:min-h-0 lg:py-1.5 disabled:opacity-50">Confirm import</button>
        </div>
      </div>
    </div>
  );
}
