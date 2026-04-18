import { promises as fs } from "fs"
import Link from "next/link"
import path from "path"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export default async function CreditsPage() {
  const file = path.join(process.cwd(), "public", "mailroom", "CREDITS.md")
  const contents = await fs.readFile(file, "utf8").catch(() => "")
  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <Link
        href="/mailroom"
        className="font-mono text-[10px] text-[var(--fg-dim)] hover:text-[var(--fg)]"
      >
        ← Back to Mailroom
      </Link>
      <h1 className="mt-4 font-display text-2xl text-[var(--fg)]">
        Mailroom Credits
      </h1>
      <pre className="mt-6 whitespace-pre-wrap border border-[var(--border)] bg-[var(--bg-warm)] p-5 text-sm text-[var(--fg)]">
        {contents}
      </pre>
    </main>
  )
}
