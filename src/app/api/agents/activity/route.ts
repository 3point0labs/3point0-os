import { NextResponse } from "next/server"
import { readAgentStates } from "@/lib/mailroom/activity"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET() {
  try {
    const states = await readAgentStates()
    return NextResponse.json({ states }, { status: 200 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error"
    return NextResponse.json(
      { states: [], error: message },
      { status: 200 },
    )
  }
}
