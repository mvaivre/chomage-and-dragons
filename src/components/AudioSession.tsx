"use client";
import { useEffect } from "react";
import { startMusic } from "@/lib/client/music";

/** The same two audio decks survive the welcome, selection and game navigation. */
export function AudioSession() {
  useEffect(() => startMusic(), []);
  return null;
}
