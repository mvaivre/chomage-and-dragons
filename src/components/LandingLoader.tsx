"use client";
import { t as tr } from "@/lib/i18n/index";

import dynamic from "next/dynamic";

/** The landing reads the groups known to this device, so it renders in the browser only. */
const Landing = dynamic(() => import("./hud/Landing").then((m) => m.Landing), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-ink-deep">
      <p className="engrave animate-pulse text-sm">{tr("Chômage & Dragons", undefined)}</p>
    </div>
  ),
});

export function LandingLoader() {
  return <Landing />;
}
