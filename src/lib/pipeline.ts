import type { Sponsor, Stage } from "./types";
import { STAGES } from "./types";

export function pipelineCounts(sponsors: Sponsor[]): Record<Stage, number> {
  const init = Object.fromEntries(STAGES.map((s) => [s, 0])) as Record<
    Stage,
    number
  >;
  for (const s of sponsors) {
    init[s.stage] = (init[s.stage] ?? 0) + 1;
  }
  return init;
}
