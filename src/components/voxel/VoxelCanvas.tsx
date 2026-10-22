"use client";
import { Dialogue } from "./Dialogue";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import {
  createVoxelWorld,
  type GameCanvasProps,
  type WorldLabel,
} from "./engine";
import {
  ENVIRONMENT_LABELS,
  type EnvironmentKind,
} from "@/lib/game/environment";
import { canChallengeDragon, dragonReply } from "@/lib/game/dragon";
import { scene, residentReactions } from "./state";
import { conversationLine, INSPECTION_SECONDS } from "./conversations";

function VoxelCanvas(props: GameCanvasProps) {
  const host = useRef<HTMLDivElement>(null),
    live = useRef(props),
    runtime = useRef<ReturnType<typeof createVoxelWorld> | null>(null);
  const [labels, setLabels] = useState<WorldLabel[]>([]),
    [error, setError] = useState(false),
    [effects, setEffects] = useState(true),
    [speech, setSpeech] = useState<{
      text: string;
      speaker: string;
      nest?: number;
      id: string;
      visit: number;
    } | null>(null);
  const visits = useRef(new Map<string, number>());
  const collectingChest = props.effects.some(
    (effect) => effect.kind === "chest",
  );
  useEffect(() => {
    if (collectingChest) queueMicrotask(() => setSpeech(null));
  }, [collectingChest]);
  const speak = useCallback(
    (label: WorldLabel, cause: "click" | "collision" = "click") => {
      const current = live.current;
      if (current.paused) return;
      if (label.kind === "sign") {
        runtime.current?.inspect(label.id);
        setSpeech(null);
        return;
      }
      const n = visits.current.get(label.id) ?? 0;
      visits.current.set(label.id, n + 1);
      residentReactions.set(label.id, { visits: n + 1, at: performance.now() });
      if (cause === "click") runtime.current?.inspect(label.id);
      const reply = label.kind === "dragon" ? dragonReply(n) : null;
      if (reply?.swallow && current.onDragonSwallow?.(label.worldX)) {
        runtime.current?.cancelInspection();
        setSpeech(null);
        return;
      }
      setSpeech({
        id: label.id,
        speaker:
          label.kind === "dragon"
            ? "Le dragon"
            : (
                ENVIRONMENT_LABELS[label.extra as EnvironmentKind] ??
                "Une rencontre"
              )
                .replace(
                  /^(Parler au |Parler à |Parler |Trinquer avec |Réveiller |Taquiner |Appeler |Interrompre |Déranger |Saluer |Observer )/,
                  (prefix) => (prefix === "Parler au " ? "Le " : ""),
                )
                .replace(/^./, (letter) => letter.toLocaleUpperCase("fr")),
        visit: n,
        text: conversationLine(label.id, label.kind, label.text, n),
        ...(reply ? { nest: label.worldX } : {}),
      });
    },
    [],
  );
  useEffect(() => {
    live.current = props;
  }, [props]);
  useEffect(() => {
    if (!speech || props.paused) return;
    const timer = window.setTimeout(
      () => setSpeech(null),
      INSPECTION_SECONDS * 1000,
    );
    return () => window.clearTimeout(timer);
  }, [speech, props.paused]);
  useEffect(() => {
    if (!host.current) return;
    try {
      runtime.current = createVoxelWorld(
        host.current,
        () => live.current,
        setLabels,
        speak,
      );
    } catch (reason) {
      console.error(reason);
      queueMicrotask(() => setError(true));
    }
    return () => {
      runtime.current?.dispose();
      runtime.current = null;
    };
  }, [speak]);
  const closeSpeech = () => {
    runtime.current?.cancelInspection();
    setSpeech(null);
  };
  return (
    <div className="voxel-world" data-renderer="voxel">
      <div className="voxel-world__canvas" ref={host} />
      {error && (
        <div className="voxel-error" role="alert">
          Le monde voxel n’a pas pu démarrer. Active WebGL 2 dans ton
          navigateur, puis recharge la page.
        </div>
      )}
      <div className="voxel-labels">
        {labels.map((label) =>
          label.kind === "player" ? (
            <span
              key={label.id}
              className={`voxel-name ${label.id === props.meId ? "is-me" : ""}`}
              style={{ left: label.x, top: label.y }}
            >
              {label.text}
            </span>
          ) : (
            <button
              key={label.id}
              type="button"
              className={`voxel-target voxel-target--${label.kind}`}
              style={{ left: label.x, top: label.y }}
              data-world-object={label.id}
              data-hidden-item={label.kind === "hidden" ? label.id : undefined}
              aria-label={
                label.kind === "hidden"
                  ? `Ramasser : ${label.text}`
                  : label.kind === "sign"
                    ? `Lire le panneau : ${label.text}`
                    : label.kind === "dragon"
                      ? "Parler au dragon"
                      : `Parler : ${ENVIRONMENT_LABELS[label.extra as EnvironmentKind] ?? label.text}`
              }
              title={
                label.kind === "hidden"
                  ? label.text
                  : label.kind === "sign"
                    ? `Lire le panneau : ${label.text}`
                    : label.kind === "dragon"
                      ? "Parler au dragon"
                      : (ENVIRONMENT_LABELS[label.extra as EnvironmentKind] ??
                        label.text)
              }
              onClick={() => {
                if (label.kind === "hidden") props.onFindHidden(label.id);
                else speak(label);
              }}
            >
              {label.kind === "hidden" || label.kind === "sign" ? null : "···"}
            </button>
          ),
        )}
      </div>
      <nav className="voxel-camera" aria-label="Caméra du monde">
        <button
          type="button"
          aria-label="Tourner la vue à gauche"
          onClick={() => runtime.current?.rotate(-1)}
        >
          ↶
        </button>
        <span>360°</span>
        <button
          type="button"
          aria-label="Tourner la vue à droite"
          onClick={() => runtime.current?.rotate(1)}
        >
          ↷
        </button>
        <button
          type="button"
          aria-label="Rapprocher la caméra"
          onClick={() => runtime.current?.zoom(1)}
        >
          ＋
        </button>
        <button
          type="button"
          aria-label="Éloigner la caméra"
          onClick={() => runtime.current?.zoom(-1)}
        >
          −
        </button>
        <button
          type="button"
          aria-label="Effets de lumière"
          aria-pressed={effects}
          onClick={() => {
            setEffects(!effects);
            runtime.current?.effects(!effects);
          }}
        >
          ✧
        </button>
        <button
          type="button"
          onClick={() => {
            runtime.current?.recenter();
            props.onReturnToMe?.();
          }}
        >
          Mon personnage
        </button>
      </nav>
      {speech && (
        <Dialogue
          key={`${speech.id}:${speech.visit}`}
          text={speech.text}
          speaker={speech.speaker}
          paused={props.paused}
          onClose={closeSpeech}
        >
          {speech.nest !== undefined && (
            <button
              type="button"
              disabled={
                !canChallengeDragon(
                  props.meId ? scene.heroes.get(props.meId)?.x : undefined,
                  speech.nest,
                  false,
                ) || props.paused
              }
              onClick={() => {
                closeSpeech();
                props.onDragonChallenge?.();
              }}
            >
              Défier le dragon
            </button>
          )}
        </Dialogue>
      )}
    </div>
  );
}
export default memo(VoxelCanvas);
