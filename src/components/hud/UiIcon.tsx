import type { ReactNode } from "react";

const paths = {
  menu: <><path d="M6 7h20M6 16h20M6 25h20" /></>,
  sword: <><path d="m12 20 13-15 2 1-1 5-13 13M7 18l8 8M5 27l6-6" /></>,
  letter: <><rect x="3" y="6" width="26" height="20" rx="2" fill="#e8d7a7" /><path d="m4 8 12 10L28 8" /></>,
  sound: <><path d="M4 12h6l7-6v20l-7-6H4z" fill="#d8c48b" /><path d="M22 10q7 6 0 12M26 5q12 11 0 22" /></>,
  effects: <><path d="M4 12h6l7-6v20l-7-6H4z" fill="#d8c48b" /><path d="M22 11q6 5 0 10" /></>,
  mute: <><path d="M4 12h6l7-6v20l-7-6H4z" fill="#d8c48b" /><path d="m22 11 8 10m0-10-8 10" /></>,
} satisfies Record<string, ReactNode>;

const art = {
  dragon: "power-dragon", fire: "power-fire", mug: "power-shot",
} as const;
export type UiIconName = keyof typeof paths | keyof typeof art;

export function UiIcon({ name, className = "" }: { name: UiIconName; className?: string }) {
  if (name in art) {
    // eslint-disable-next-line @next/next/no-img-element -- shared preoptimized game art
    return <img className={`ui-icon ${className}`} src={`/art/world-v3/ui/${art[name as keyof typeof art]}.webp`} alt="" aria-hidden draggable={false} />;
  }
  return <svg className={`ui-icon ${className}`} viewBox="0 0 32 32" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{paths[name as keyof typeof paths]}</svg>;
}
