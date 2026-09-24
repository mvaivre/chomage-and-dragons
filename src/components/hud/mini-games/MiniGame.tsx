"use client";

import { useState } from "react";

import type { MiniGameKind } from "@/lib/data/types";
import { GhostingGame } from "./GhostingGame";
import { KeywordsGame } from "./KeywordsGame";
import type { MiniGameProps } from "./MiniGameShell";
import { PigeonGame } from "./PigeonGame";
import { QuizGame } from "./QuizGame";
import { SlotsGame } from "./SlotsGame";
import { StampGame } from "./StampGame";

/** One optional challenge per action; the reservation logic lives in lib/game/mini-games. */
export function MiniGame({ kind, ...live }: MiniGameProps & { kind: MiniGameKind }) {
  // The record to beat is the one standing when the game opened: once your own
  // score is saved, it must not turn "new record" into "your best".
  const [standing] = useState(() => ({ record: live.record ?? null, best: live.best ?? null }));
  const props = { ...live, record: standing.record, best: standing.best };
  switch (kind) {
    case "pigeon": return <PigeonGame {...props} />;
    case "keywords": return <KeywordsGame {...props} />;
    case "stamp": return <StampGame {...props} />;
    case "quiz": return <QuizGame {...props} />;
    case "ghosting": return <GhostingGame {...props} />;
    case "slots": return <SlotsGame {...props} />;
  }
}
