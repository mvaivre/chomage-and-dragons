"use client";
import { t as tr } from "@/lib/i18n/index";
import { useLocale } from "@/lib/i18n/react";

import { UiIcon } from "./UiIcon";
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
  const uiLocale = useLocale();
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
    aria-label={tr(STATES[state].label, undefined, uiLocale)} title={tr(STATES[state].label, undefined, uiLocale)} onClick={next}>
    <UiIcon name={STATES[state].icon} />
  </button>;
}
