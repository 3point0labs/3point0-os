"use client";

import { useEffect, useRef } from "react";
import { runScheduledDiscoveryIfDue } from "@/app/actions/discovery";

/** Runs scheduled auto-discovery once per tab load when due */
export function DiscoveryScheduler() {
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    void runScheduledDiscoveryIfDue().then((res) => {
      if (res.ok && res.ran) {
        console.log("[discovery] scheduled run executed");
      }
    });
  }, []);

  return null;
}
