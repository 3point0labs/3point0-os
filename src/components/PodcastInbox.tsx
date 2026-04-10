"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { draftInboxReply, type InboxEmail } from "@/app/actions/inbox";

function categoryBadge(cat: InboxEmail["category"]) {
  if (cat === "sponsorship")
    return "border-[rgba(201,168,124,0.5)] bg-[rgba(201,168,124,0.12)] text-[var(--color-accent-primary)]";
  if (cat === "guest_request")
    return "border-[rgba(0,212,170,0.4)] bg-[rgba(0,212,170,0.08)] text-[#00d4aa]";
  return "border-[rgba(138,138,122,0.4)] bg-[rgba(138,138,122,0.08)] text-[var(--color-text-secondary)]";
}

function categoryLabel(cat: InboxEmail["category"]) {
  if (cat === "sponsorship") return "Sponsor";
  if (cat === "guest_request") return "Guest Req";
  return "Other";
}

function categorize(subject: string, snippet: string): InboxEmail["category"] {
  const text = `${subject} ${snippet}`.toLowerCase();
  if (text.includes("sponsor") || text.includes("partner") || text.includes("collab") || text.includes("commission") || text.includes("advertis")) return "sponsorship";
  if (text.includes("guest") || text.includes("interview") || text.includes("episode") || text.includes("request")) return "guest_request";
  return "other";
}

type RawEmail = {
  messageId: string;
  threadId: string;
  from: string;
  subject: string;
  snippet: string;
  date: string;
  isUnread: boolean;
};

export function PodcastInbox() {
  const [emails, setEmails] = useState<InboxEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    fetch("/api/inbox")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) { setError(data.error); setLoading(false); return; }
        const mapped: InboxEmail[] = (data.emails as RawEmail[]).map((e) => ({
          ...e,
          category: categorize(e.subject, e.snippet),
        }));
        setEmails(mapped);
        setLoading(false);
      })
      .catch(() => { setError("Failed to load inbox"); setLoading(false); });
  }, []);

  const draftReply = useCallback((email: InboxEmail) => {
    if (drafts[email.messageId]) return;
    startTransition(() => {
      void draftInboxReply(
        email.snippet,
        email.subject,
        email.category,
        email.from
      ).then((res) => {
        if (res.ok) setDrafts((prev) => ({ ...prev, [email.messageId]: res.draft }));
      });
    });
  }, [drafts]);

  const unreadCount = emails.filter((e) => e.isUnread).length;

  return (
    <section className="mission-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="font-mono text-sm uppercase tracking-[0.18em] text-[var(--color-accent-eggshell)]">
            One54 Inbox
          </h2>
          {unreadCount > 0 && (
            <span className="rounded-full bg-[rgba(232,83,61,0.2)] px-2 py-0.5 font-mono text-[10px] text-[var(--color-accent-coral)]">
              {unreadCount} new
            </span>
          )}
        </div>
        <a
          href="https://mail.google.com/mail/u/0/#search/to%3Ainquiries%40one54africa.com+OR+from%3Ainquiries%40one54africa.com"
          target="_blank"
          rel="noreferrer"
          className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-text-secondary)] hover:text-[var(--color-accent-primary)]"
        >
          Open Gmail ↗
        </a>
      </div>

      {loading && (
        <p className="animate-pulse font-mono text-xs uppercase tracking-wider text-[var(--color-accent-coral)]">
          Loading inbox...
        </p>
      )}
      {error && <p className="text-xs text-[var(--color-accent-coral)]">{error}</p>}
      {!loading && emails.length === 0 && !error && (
        <p className="text-sm text-[var(--color-text-secondary)]">No recent inquiries.</p>
      )}

      <div className="space-y-2">
        {emails.map((email) => {
          const isOpen = expanded === email.messageId;
          const draft = drafts[email.messageId];
          return (
            <div
              key={email.messageId}
              className={`glass-card rounded-lg overflow-hidden ${email.isUnread ? "ring-1 ring-[rgba(232,83,61,0.3)]" : ""}`}
            >
              <button
                type="button"
                onClick={() => {
                  setExpanded(isOpen ? null : email.messageId);
                  if (!isOpen && !draft) draftReply(email);
                }}
                className="flex w-full items-start gap-2 p-3 text-left"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {email.isUnread && (
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-accent-coral)]" />
                    )}
                    <span
                      className={`rounded border px-1.5 py-0.5 font-mono text-[9px] uppercase ${categoryBadge(email.category)}`}
                    >
                      {categoryLabel(email.category)}
                    </span>
                    <p className="truncate text-xs font-medium text-[var(--color-accent-eggshell)]">
                      {email.subject}
                    </p>
                  </div>
                  <p className="mt-0.5 truncate text-[10px] text-[var(--color-text-secondary)]">
                    {email.from} · {email.date ? new Date(email.date).toLocaleDateString() : ""}
                  </p>
                  {!isOpen && (
                    <p className="mt-1 line-clamp-1 text-[10px] text-[var(--color-text-secondary)]">
                      {email.snippet}
                    </p>
                  )}
                </div>
                <span className="shrink-0 text-[10px] text-[var(--color-text-secondary)]">
                  {isOpen ? "▲" : "▼"}
                </span>
              </button>

              {isOpen && (
                <div className="border-t border-[var(--color-border)] p-3">
                  <p className="text-xs leading-relaxed text-[color-mix(in_srgb,var(--color-accent-eggshell)_80%,transparent)]">
                    {email.snippet}
                  </p>

                  {!draft && (
                    <p className="mt-2 animate-pulse font-mono text-[10px] text-[var(--color-accent-coral)]">
                      Drafting reply...
                    </p>
                  )}

                  {draft && (
                    <div className="mt-3">
                      <p className="mb-1 font-mono text-[10px] uppercase tracking-wider text-[var(--color-text-secondary)]">
                        Agent draft
                      </p>
                      <pre className="whitespace-pre-wrap rounded-md border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-2 font-sans text-[11px] leading-relaxed text-[var(--color-accent-eggshell)]">
                        {draft}
                      </pre>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            void navigator.clipboard.writeText(draft).then(() => {
                              setCopied(email.messageId);
                              setTimeout(() => setCopied(null), 2000);
                            });
                          }}
                          className="min-h-8 rounded border border-[rgba(var(--accent-rgb),0.45)] bg-[rgba(var(--accent-rgb),0.1)] px-2.5 font-mono text-[10px] uppercase tracking-wider text-[color:var(--accent)]"
                        >
                          {copied === email.messageId ? "✓ Copied" : "Copy"}
                        </button>
                        <a
                          href={`https://mail.google.com/mail/u/0/#all/${email.threadId}`}
                          target="_blank"
                          rel="noreferrer"
                          className="min-h-8 rounded border border-[rgba(232,83,61,0.4)] bg-[rgba(232,83,61,0.1)] px-2.5 font-mono text-[10px] uppercase tracking-wider text-[var(--color-accent-coral)]"
                        >
                          Reply in Gmail ↗
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}