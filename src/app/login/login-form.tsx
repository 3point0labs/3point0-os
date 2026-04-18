"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function LoginForm() {
  const supabase = useMemo(() => {
    if (typeof window === "undefined") return null;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url?.trim() || !key?.trim()) return null;
    return createClient();
  }, []);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  async function signInWithGoogle() {
    setError(null);
    if (!supabase) {
      setError("Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
      return;
    }
    setPending(true);
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${origin}/auth/callback`,
      },
    });
    setPending(false);
    if (err) setError(err.message);
  }

  async function signInWithEmail(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!supabase) {
      setError("Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
      return;
    }
    setPending(true);
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    setPending(false);
    if (err) {
      setError(err.message);
      return;
    }
    window.location.href = "/command";
  }

  return (
    <div className="login-card w-full max-w-md p-8">
      <div className="text-center">
        <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.35em] text-[var(--color-text-secondary)]">
          Mission Control
        </p>
      </div>

      <div className="my-6 h-px bg-[rgba(139,69,19,0.2)]" />

      <button
        type="button"
        disabled={pending}
        onClick={() => void signInWithGoogle()}
        className="flex min-h-[44px] w-full items-center justify-center gap-3 rounded-lg border border-[#8B4513] bg-[rgba(139,69,19,0.1)] px-4 py-3 font-mono text-sm text-[#8B4513] transition hover:bg-[rgba(139,69,19,0.2)] disabled:opacity-50"
      >
        <GoogleIcon />
        Continue with Google
      </button>

      <div className="my-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-[var(--color-border)]" />
        <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-text-secondary)]">or</span>
        <div className="h-px flex-1 bg-[var(--color-border)]" />
      </div>

      <form onSubmit={signInWithEmail} className="space-y-4">
        <label className="block">
          <span className="sr-only">Email</span>
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="mono-raw min-h-[44px] w-full border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--fg)] outline-none ring-0 placeholder:text-[var(--fg-mute)] focus:border-[var(--accent)]"
          />
        </label>
        <label className="block">
          <span className="sr-only">Password</span>
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="mono-raw min-h-[44px] w-full border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--fg)] outline-none placeholder:text-[var(--fg-mute)] focus:border-[var(--accent)]"
          />
        </label>
        {error && <p className="text-center text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={pending}
          className="min-h-[44px] w-full border border-[var(--accent)] bg-[var(--accent)] px-4 py-3 font-mono text-sm font-medium text-[var(--bg-warm)] transition hover:bg-[var(--accent-hover)] hover:border-[var(--accent-hover)] disabled:opacity-50"
        >
          Sign in
        </button>
      </form>

      <p className="mt-6 text-center font-mono text-[11px] leading-relaxed text-[var(--color-text-secondary)]">
        Access restricted. Contact admin for an invite.
      </p>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="currentColor"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="currentColor"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="currentColor"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="currentColor"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}
