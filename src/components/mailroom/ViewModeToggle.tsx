"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { setViewMode } from "@/app/actions/view-mode"
import type { ViewMode } from "@/lib/types/profile"

type Props = {
  current: ViewMode
}

export function ViewModeToggle({ current }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const handleSwitch = (next: ViewMode) => {
    if (next === current || pending) return
    startTransition(async () => {
      await setViewMode(next).catch(() => null)
      try {
        window.localStorage.setItem("3point0.viewMode", next)
      } catch {
        /* ignore */
      }
      router.push(next === "pixel" ? "/mailroom" : "/command")
      router.refresh()
    })
  }

  const base =
    "min-h-[32px] min-w-[80px] px-3 py-1 font-mono text-[10px] border transition-colors"
  const active =
    "border-[var(--accent)] bg-[var(--accent)] text-[var(--bg-warm)]"
  const idle =
    "border-[var(--border)] bg-transparent text-[var(--fg-dim)] hover:text-[var(--fg)]"

  return (
    <div
      className="inline-flex items-stretch border border-[var(--border)] bg-[var(--bg-warm)]"
      role="group"
      aria-label="Switch view"
    >
      <button
        type="button"
        onClick={() => handleSwitch("pixel")}
        className={`${base} ${current === "pixel" ? active : idle}`}
        disabled={pending}
      >
        Pixel
      </button>
      <button
        type="button"
        onClick={() => handleSwitch("classic")}
        className={`${base} ${current === "classic" ? active : idle}`}
        disabled={pending}
      >
        Classic
      </button>
    </div>
  )
}

export function ViewModeLinkToggle({ current }: Props) {
  // SSR-safe version that simply links — used in places that can't run
  // the mutation (e.g. inside pure server components). Clicking still
  // persists via the client toggle on the target page.
  return (
    <div
      className="inline-flex items-stretch border border-[var(--border)] bg-[var(--bg-warm)]"
      role="group"
      aria-label="Switch view"
    >
      <Link
        href="/mailroom"
        className={`min-h-[32px] min-w-[80px] px-3 py-1 font-mono text-[10px] border ${
          current === "pixel"
            ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--bg-warm)]"
            : "border-[var(--border)] text-[var(--fg-dim)]"
        }`}
      >
        Pixel
      </Link>
      <Link
        href="/command"
        className={`min-h-[32px] min-w-[80px] px-3 py-1 font-mono text-[10px] border ${
          current === "classic"
            ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--bg-warm)]"
            : "border-[var(--border)] text-[var(--fg-dim)]"
        }`}
      >
        Classic
      </Link>
    </div>
  )
}
