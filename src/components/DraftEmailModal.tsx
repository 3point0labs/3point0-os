"use client";

import { useCallback, useEffect, useState } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  body: string;
  recommendedChannel?: string;
  channelReason?: string;
  attachDeck: boolean;
  onToggleAttachDeck: (value: boolean) => void;
  loading: boolean;
  error: string | null;
};

export function DraftEmailModal({
  open,
  onClose,
  title,
  body,
  recommendedChannel,
  channelReason,
  attachDeck,
  onToggleAttachDeck,
  loading,
  error,
}: Props) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) setCopied(false);
  }, [open, body]);

  const copy = useCallback(async () => {
    const textToCopy =
      body +
      (attachDeck
        ? "\n\nHappy to share our media kit / deck if that would be helpful context."
        : "");
    if (!textToCopy.trim()) return;
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, [attachDeck, body]);

  if (!open) return null;

  const displayBody =
    body +
    (attachDeck
      ? "\n\nHappy to share our media kit / deck if that would be helpful context."
      : "");

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
      <div className="glass-card relative z-10 max-h-[85vh] w-full max-w-3xl overflow-hidden rounded-xl shadow-2xl shadow-black/60">
        <div className="flex items-start justify-between gap-4 border-b border-[var(--color-border)] px-5 py-4">
          <div>
            <h2 id="draft-email-title" className="font-mono text-lg tracking-tight text-[var(--color-accent-eggshell)]">
              Draft Outreach Email
            </h2>
            <p className="mt-1 font-mono text-xs uppercase tracking-wider text-[var(--color-text-secondary)]">{title}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-lg border border-[var(--color-border)] p-2 text-[var(--color-text-secondary)] hover:bg-[rgba(201,168,124,0.1)] hover:text-[var(--color-accent-eggshell)]"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="max-h-[calc(85vh-9rem)] overflow-y-auto px-5 py-4">
          {loading && (
            <p className="font-mono text-sm text-[var(--color-accent-primary)]">Drafting with Claude...</p>
          )}
          {!loading && !error && recommendedChannel && (
            <div className="mb-3 rounded-lg border border-[rgba(232,83,61,0.35)] bg-[rgba(232,83,61,0.1)] px-3 py-2">
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
          {!loading && !error && displayBody && (
            <pre className="glass-card whitespace-pre-wrap rounded-lg p-4 font-sans text-sm leading-relaxed text-[color-mix(in_srgb,var(--color-accent-eggshell)_88%,transparent)]">
              {displayBody}
            </pre>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-border)] px-5 py-4">
          <label className="flex min-h-11 items-center gap-2 text-sm text-[var(--color-text-secondary)]">
            <input
              type="checkbox"
              checked={attachDeck}
              onChange={(e) => onToggleAttachDeck(e.target.checked)}
              className="h-4 w-4 rounded border-[var(--color-border-strong)] bg-[var(--color-bg-primary)] accent-[var(--color-accent-coral)]"
            />
            <span>Mention media kit is available upon request</span>
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={copy}
              disabled={loading || !body || !!error}
              className="btn-cta disabled:cursor-not-allowed disabled:opacity-40"
            >
              {copied ? "Copied" : "Copy to clipboard"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="min-h-11 rounded-lg border border-[var(--color-border)] px-4 py-2 font-mono text-xs uppercase tracking-wider text-[var(--color-text-secondary)] hover:bg-[rgba(201,168,124,0.08)]"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
