import { getRocketReachCredits } from "@/app/actions/enrich-contact";

export const dynamic = "force-dynamic";

export default async function TestRocketReachPage() {
  const credits = await getRocketReachCredits();

  return (
    <div style={{ padding: "2rem", fontFamily: "monospace", fontSize: "14px" }}>
      <h1>RocketReach — Credits Check</h1>
      <pre
        style={{
          background: "#111",
          color: "#0f0",
          padding: "1rem",
          overflow: "auto",
        }}
      >
        {JSON.stringify(credits, null, 2)}
      </pre>
    </div>
  );
}