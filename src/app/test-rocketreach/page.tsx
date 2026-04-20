import { checkAccount } from "@/lib/rocketreach";
import { getRocketReachCredits } from "@/app/actions/enrich-contact";

export const dynamic = "force-dynamic";

export default async function TestRocketReachPage() {
  const rawAccount = await checkAccount();
  const cached = await getRocketReachCredits();

  return (
    <div style={{ padding: "2rem", fontFamily: "monospace", fontSize: "14px" }}>
      <h1>RocketReach API Test</h1>

      <h2 style={{ marginTop: "2rem" }}>Raw /account response</h2>
      <pre style={{ background: "#111", color: "#0f0", padding: "1rem", overflow: "auto" }}>
        {JSON.stringify(rawAccount, null, 2)}
      </pre>

      <h2 style={{ marginTop: "2rem" }}>Cached credits result</h2>
      <pre style={{ background: "#111", color: "#0f0", padding: "1rem", overflow: "auto" }}>
        {JSON.stringify(cached, null, 2)}
      </pre>
    </div>
  );
}