"use client";

import { VoxelIcon } from "./VoxelIcon";
import { useEffect, useState } from "react";
import { isMuted, onMuteChange, setMuted, sfx } from "@/lib/client/sound";
import { isMusicOn, onMusicChange, setMusicOn } from "@/lib/client/music";

const STATES = {
  all: { icon: "sound", label: "Musique et effets : couper la musique" },
  effects: { icon: "effects", label: "Effets seuls : tout couper" },
  none: { icon: "mute", label: "Son coupé : remettre la musique et les effets" },
} as const;

/** One button, three states: music and effects, effects only, silence. Remembered on this device. */
export function SoundToggle() {
  const [muted, setMutedState] = useState(isMuted);
  const [music, setMusicState] = useState(isMusicOn);
  useEffect(() => onMuteChange(setMutedState), []);
  useEffect(() => onMusicChange(setMusicState), []);
  const state = muted ? "none" : music ? "all" : "effects";
  const next = () => {
    if (state === "all") setMusicOn(false);
    else if (state === "effects") setMuted(true);
    else {
      setMuted(false);
      setMusicOn(true);
      sfx.press();
    }
  };
  return <button type="button" className="sound-toggle pointer-events-auto" data-state={state}
    aria-label={STATES[state].label} title={STATES[state].label} onClick={next}>
    <VoxelIcon name={STATES[state].icon} />
  </button>;
}
