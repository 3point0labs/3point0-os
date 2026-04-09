import "dotenv/config"
import { createClient } from "@supabase/supabase-js"
import fs from "fs"
import path from "path"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function migrate() {
  const filePath = path.join(process.cwd(), "data", "sponsors.json")
  const raw = fs.readFileSync(filePath, "utf-8")
  const sponsors = JSON.parse(raw)

  console.log(`Migrating ${sponsors.length} contacts...`)

  const mapped = sponsors.map((s: any) => ({
    contact_name: s.contactName || s.contact_name || "",
    company: s.company || s.brand || "",
    email: s.email || "",
    podcast: s.podcast || "One54",
    stage: s.stage || s.status || "New",
    category: s.category || "",
    tier: s.tier || "",
    contact_title: s.contactTitle || s.contact_title || s.title || "",
    linkedin_url: s.linkedinUrl || s.linkedin_url || "",
    pitch_angle: s.pitchAngle || s.pitch_angle || "",
    notes: s.notes || "",
    next_action: s.nextAction || s.next_action || "",
  }))

  const batchSize = 20
  for (let i = 0; i < mapped.length; i += batchSize) {
    const batch = mapped.slice(i, i + batchSize)
    const { error } = await supabase
      .from("sponsors")
      .upsert(batch, { onConflict: "company,email" })

    if (!error) {
      console.log(`Migrated ${Math.min(i + batchSize, mapped.length)}/${mapped.length}`)
      continue
    }

    if (error.code === "42P10") {
      const { error: insertError } = await supabase.from("sponsors").insert(batch)
      if (insertError) {
        console.error("Batch insert fallback error:", insertError)
      } else {
        console.log(
          `Migrated ${Math.min(i + batchSize, mapped.length)}/${mapped.length} (insert fallback)`
        )
      }
      continue
    }

    console.error("Batch error:", error)
  }

  console.log("Migration complete!")
}

migrate()
