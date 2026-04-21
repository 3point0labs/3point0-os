"use client";

import { useCallback, useEffect, useState } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  body: string;
  toEmail?: string;
  subject?: string;
  recommendedChannel?: string;
  channelReason?: string;
  linkedinMessage?: string | null;
  linkedinUrl?: string | null;
  sponsorId?: string;
  attachDeck: boolean;
  onToggleAttachDeck: (value: boolean) => void;
  loading: boolean;
  error: string | null;
};

type SendState = "idle" | "sending" | "sent" | "error";

export function DraftEmailModal({
  open,
  onClose,
  title,
  body,
  toEmail,
  subject,
  recommendedChannel,
  channelReason,
  linkedinMessage,
  linkedinUrl,
  sponsorId,
  attachDeck,
  onToggleAttachDeck,
  loading,
  error,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [liCopied, setLiCopied] = useState(false);

  const [editTo, setEditTo] = useState(toEmail ?? "");
  const [editSubject, setEditSubject] = useState(subject ?? "");
  const [editBody, setEditBody] = useState("");
  const [editLinkedin, setEditLinkedin] = useState("");

  const [sendState, setSendState] = useState<SendState>("idle");
  const [sendError, setSendError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setEditTo(toEmail ?? "");
    setEditSubject(subject ?? "");
    const withDeck =
      body +
      (attachDeck
        ? "\n\nHappy to share our media kit / deck if that would be helpful context."
        : "");
    setEditBody(withDeck);
    setEditLinkedin(linkedinMessage ?? "");
    setSendState("idle");
    setSendError(null);
  }, [open, toEmail, subject, body, attachDeck, linkedinMessage]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) {
      setCopied(false);
      setLiCopied(false);
    }
  }, [open]);

  const copy = useCallback(async () => {
    if (!editBody.trim()) return;
    try {
      await navigator.clipboard.writeText(editBody);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, [editBody]);

  const copyLinkedin = useCallback(async () => {
    if (!editLinkedin.trim()) return;
    try {
      await navigator.clipboard.writeText(editLinkedin);
      setLiCopied(true);
      window.setTimeout(() => setLiCopied(false), 2000);
    } catch {
      setLiCopied(false);
    }
  }, [editLinkedin]);

  const handleSendGmail = useCallback(async () => {
    if (!editTo.trim() || !editSubject.trim() || !editBody.trim()) {
      setSendState("error");
      setSendError("To, Subject, and Body are required.");
      return;
    }
    setSendState("sending");
    setSendError(null);
    try {
      const res = await fetch("/api/gmail/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: editTo.trim(),
          subject: editSubject.trim(),
          body: editBody,
          sponsorId: sponsorId || undefined,
        }),
      });
      const data = (await res.json()) as { sent?: boolean; error?: string; detail?: string };
      if (!res.ok || !data.sent) {
        setSendState("error");
        setSendError(data.error || data.detail || `Send failed (${res.status})`);
        return;
      }
      setSendState("sent");
      window.setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      setSendState("error");
      setSendError(err instanceof Error ? err.message : "Network error");
    }
  }, [editTo, editSubject, editBody, onClose]);

  if (!open) return null;

  const sending = sendState === "sending";
  const sent = sendState === "sent";
  const hasLinkedin = Boolean(editLinkedin.trim());

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="draft-email-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close dialog"
      />
      <div className="glass-card relative z-10 flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl shadow-2xl shadow-black/60">
        <div className="flex items-start justify-between gap-4 border-b border-[var(--color-border)] px-5 py-4">
          <div>
            <h2
              id="draft-email-title"
              className="font-mono text-lg tracking-tight text-[var(--color-accent-eggshell)]"
            >
              Draft Outreach Email
            </h2>
            <p className="mt-1 font-mono text-xs uppercase tracking-wider text-[var(--color-text-secondary)]">
              {title}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-lg border border-[var(--color-border)] p-2 text-[var(--color-text-secondary)] hover:bg-[rgba(139,69,19,0.1)] hover:text-[var(--color-accent-eggshell)]"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {loading && (
            <p className="font-mono text-sm text-[var(--color-accent-primary)]">Drafting with Claude...</p>
          )}
          {!loading && !error && recommendedChannel && (
            <div className="mb-3 rounded-lg border border-[rgba(160,85,42,0.35)] bg-[rgba(160,85,42,0.1)] px-3 py-2">
              <p className="font-mono text-[11px] uppercase tracking-wider text-[var(--color-accent-coral)]">
                RECOMMENDED CHANNEL: {recommendedChannel}
              </p>
              {channelReason && (
                <p className="mt-1 text-xs text-[color-mix(in_srgb,var(--color-accent-eggshell)_85%,transparent)]">
                  {channelReason}
                </p>
              )}
            </div>
          )}
          {error && !loading && (
            <p className="rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-300">
              {error}
            </p>
          )}

          {!loading && !error && (
            <div className="space-y-3">
              <div>
                <label className="mb-1 block font-mono text-[11px] uppercase tracking-wider text-[var(--color-text-secondary)]">
                  To
                </label>
                <input
                  type="email"
                  value={editTo}
                  onChange={(e) => setEditTo(e.target.value)}
                  disabled={sending || sent}
                  placeholder="recipient@company.com"
                  className="min-h-11 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-2.5 py-2 text-sm text-[var(--color-accent-eggshell)] outline-none placeholder:text-[var(--color-text-secondary)] disabled:opacity-60"
                />
              </div>
              <div>
                <label className="mb-1 block font-mono text-[11px] uppercase tracking-wider text-[var(--color-text-secondary)]">
                  Subject
                </label>
                <input
                  type="text"
                  value={editSubject}
                  onChange={(e) => setEditSubject(e.target.value)}
                  disabled={sending || sent}
                  className="min-h-11 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-2.5 py-2 text-sm text-[var(--color-accent-eggshell)] outline-none disabled:opacity-60"
                />
              </div>
              <div>
                <label className="mb-1 block font-mono text-[11px] uppercase tracking-wider text-[var(--color-text-secondary)]">
                  Body
                </label>
                <textarea
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                  disabled={sending || sent}
                  rows={14}
                  className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 py-2.5 font-sans text-sm leading-relaxed text-[color-mix(in_srgb,var(--color-accent-eggshell)_88%,transparent)] outline-none disabled:opacity-60"
                />
              </div>

              {hasLinkedin && (
                <div className="rounded-lg border border-[rgba(0,119,181,0.35)] bg-[rgba(0,119,181,0.08)] p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="font-mono text-[11px] uppercase tracking-wider text-[#0077b5]">
                      LinkedIn connection note
                    </p>
                    <div className="flex items-center gap-2">
                      {linkedinUrl && (
                        <a
                          href={linkedinUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="min-h-9 rounded border border-[rgba(0,119,181,0.45)] px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-[#0077b5] hover:bg-[rgba(0,119,181,0.15)]"
                          tabIndex={0}
                          aria-label="Open LinkedIn profile"
                        >
                          Open profile
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={copyLinkedin}
                        disabled={sending || sent}
                        className="min-h-9 rounded border border-[rgba(0,119,181,0.45)] bg-[rgba(0,119,181,0.12)] px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-[#0077b5] hover:bg-[rgba(0,119,181,0.2)] disabled:opacity-40"
                      >
                        {liCopied ? "✓ Copied" : "Copy"}
                      </button>
                    </div>
                  </div>
                  <textarea
                    value={editLinkedin}
                    onChange={(e) => setEditLinkedin(e.target.value)}
                    disabled={sending || sent}
                    rows={3}
                    className="w-full rounded-md border border-[rgba(0,119,181,0.3)] bg-[var(--color-bg-primary)] px-2.5 py-2 font-sans text-sm leading-relaxed text-[color-mix(in_srgb,var(--color-accent-eggshell)_88%,transparent)] outline-none disabled:opacity-60"
                  />
                  <p className="mt-1.5 text-[10px] text-[var(--color-text-secondary)]">
                    Send the email first, then paste this as a LinkedIn connection request.
                  </p>
                </div>
              )}

              {sendState === "error" && sendError && (
                <p className="rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-300">
                  {sendError}
                </p>
              )}
              {sent && (
                <p className="rounded-lg border border-[rgba(0,212,170,0.45)] bg-[rgba(0,212,170,0.12)] px-3 py-2 font-mono text-sm uppercase tracking-wider text-[#00d4aa]">
                  ✓ Sent via Gmail
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-border)] px-5 py-4">
          <label className="flex min-h-11 items-center gap-2 text-sm text-[var(--color-text-secondary)]">
            <input
              type="checkbox"
              checked={attachDeck}
              onChange={(e) => onToggleAttachDeck(e.target.checked)}
              disabled={sending || sent}
              className="h-4 w-4 rounded border-[var(--color-border-strong)] bg-[var(--color-bg-primary)] accent-[var(--color-accent-coral)]"
            />
            <span>Mention media kit is available upon request</span>
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleSendGmail}
              disabled={
                loading ||
                !editBody ||
                !editTo ||
                !editSubject ||
                !!error ||
                sending ||
                sent
              }
              className="min-h-11 rounded-lg border border-[rgba(160,85,42,0.45)] bg-[rgba(160,85,42,0.12)] px-4 py-2 font-mono text-xs uppercase tracking-wider text-[var(--color-accent-coral)] transition hover:bg-[rgba(160,85,42,0.2)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span className="inline-flex items-center gap-2">
                <GmailIcon />
                {sending ? "Sending..." : sent ? "Sent" : "Send via Gmail"}
              </span>
            </button>
            <button
              type="button"
              onClick={copy}
              disabled={loading || !editBody || !!error || sending}
              className="btn-cta disabled:cursor-not-allowed disabled:opacity-40"
            >
              {copied ? "Copied" : "Copy to clipboard"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="min-h-11 rounded-lg border border-[var(--color-border)] px-4 py-2 font-mono text-xs uppercase tracking-wider text-[var(--color-text-secondary)] hover:bg-[rgba(139,69,19,0.08)]"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function GmailIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="currentColor"
        d="M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2m0 4.24-8 5-8-5V6l8 5 8-5z"
      />
    </svg>
  );
}