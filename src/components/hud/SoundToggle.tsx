"use client";

import { useEffect, useState } from "react";
import { isMuted, onMuteChange, setMuted, sfx } from "@/lib/client/sound";

/** One button to silence the game; the choice is remembered on this device. */
export function SoundToggle() {
  const [muted, setState] = useState(isMuted);
  useEffect(() => onMuteChange(setState), []);
  return <button type="button" className="sound-toggle pointer-events-auto" aria-pressed={!muted}
    aria-label={muted ? "Activer le son" : "Couper le son"} title={muted ? "Activer le son" : "Couper le son"}
    onClick={() => { setMuted(!muted); if (muted) sfx.press(); }}>
    <span aria-hidden>{muted ? "🔇" : "🔊"}</span>
  </button>;
}
