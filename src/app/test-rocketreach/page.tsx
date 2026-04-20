import { getRocketReachCredits } from "@/app/actions/enrich-contact";

export default async function TestRocketReachPage() {
  const result = await getRocketReachCredits();

  return (
    <div style={{ padding: "2rem", fontFamily: "monospace" }}>
      <h1>RocketReach API Test</h1>
      <pre>{JSON.stringify(result, null, 2)}</pre>
    </div>
  );
}