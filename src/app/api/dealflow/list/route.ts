import { NextResponse } from "next/server"
import { getDealFlowContacts } from "@/app/actions/dealflow"

export async function GET() {
  try {
    const contacts = await getDealFlowContacts()
    return NextResponse.json({ contacts })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load contacts." },
      { status: 500 }
    )
  }
}
