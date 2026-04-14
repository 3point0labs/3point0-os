import { NextResponse } from "next/server";
import { runScheduledDiscoveryIfDue } from "@/app/actions/discovery";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await runScheduledDiscoveryIfDue();
  return NextResponse.json(result);
}