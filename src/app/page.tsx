import { redirect } from "next/navigation"
import { getServerProfile } from "@/lib/auth-server"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export default async function Home() {
  const profile = await getServerProfile()
  if (!profile) redirect("/login")
  const mode = profile.view_mode ?? "pixel"
  redirect(mode === "classic" ? "/command" : "/mailroom")
}
