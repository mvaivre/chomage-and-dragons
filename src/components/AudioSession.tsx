"use client";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { startMusic, setMusicPhase } from "@/lib/client/music";

/** The same two audio decks survive the welcome, selection and game navigation. */
export function AudioSession() {
  const path = usePathname();
  useEffect(() => startMusic(), []);
  useEffect(() => { if (path === "/" || path.endsWith("/rejoindre")) setMusicPhase("intro"); }, [path]);
  return null;
}
