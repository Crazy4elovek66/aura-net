"use client";

import { useEffect } from "react";
import { checkAndApplyDecay } from "@/lib/decay";

export default function DecayCheck({ profileId }: { profileId: string }) {
  useEffect(() => {
    if (profileId) {
      checkAndApplyDecay(profileId).then((lost) => {
        if (lost && lost > 0) {
          console.log(`[Decay] You lost ${lost} aura due to inactivity. Stay alpha.`);
        }
      });
    }
  }, [profileId]);

  return null;
}
