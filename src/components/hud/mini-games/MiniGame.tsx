"use client";

import type { MiniGameKind } from "@/lib/data/types";
import { GhostingGame } from "./GhostingGame";
import { KeywordsGame } from "./KeywordsGame";
import type { MiniGameProps } from "./MiniGameShell";
import { PigeonGame } from "./PigeonGame";
import { QuizGame } from "./QuizGame";
import { SlotsGame } from "./SlotsGame";
import { StampGame } from "./StampGame";

/** One optional challenge per action; the reservation logic lives in lib/game/mini-games. */
export function MiniGame({ kind, ...props }: MiniGameProps & { kind: MiniGameKind }) {
  switch (kind) {
    case "pigeon": return <PigeonGame {...props} />;
    case "keywords": return <KeywordsGame {...props} />;
    case "stamp": return <StampGame {...props} />;
    case "quiz": return <QuizGame {...props} />;
    case "ghosting": return <GhostingGame {...props} />;
    case "slots": return <SlotsGame {...props} />;
  }
}
