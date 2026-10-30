"use client";
import { t as tr } from "@/lib/i18n/index";
import { useLocale } from "@/lib/i18n/react";
import { Dialogue } from "../hud/Dialogue";
import { WorldLabelLayer } from "./label-layer";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { createVoxelWorld, type GameCanvasProps, type WorldLabel, } from "./engine";
import { ENVIRONMENT_LABELS, type EnvironmentKind, } from "@/lib/game/environment";
import { canChallengeDragon, dragonReply } from "@/lib/game/dragon";
import { scene, residentReactions } from "./state";
import { conversationLine, INSPECTION_SECONDS } from "./conversations";
const worlds = new Set<ReturnType<typeof createVoxelWorld>>();
export const activeVoxelWorlds = () => worlds.size;
export function releaseVoxelWorlds() {
    for (const world of worlds)
        world.dispose();
    worlds.clear();
}
function VoxelCanvas(props: GameCanvasProps) {
    const uiLocale = useLocale();
    const host = useRef<HTMLDivElement>(null), labelHost = useRef<HTMLDivElement>(null), live = useRef(props), runtime = useRef<ReturnType<typeof createVoxelWorld> | null>(null);
    const [error, setError] = useState(false), [effects, setEffects] = useState(true), [speech, setSpeech] = useState<{
        text: string;
        speaker: string;
        nest?: number;
        id: string;
        visit: number;
    } | null>(null);
    const visits = useRef(new Map<string, number>());
    const collectingChest = props.effects.some((effect) => effect.kind === "chest");
    useEffect(() => {
        if (collectingChest)
            queueMicrotask(() => setSpeech(null));
    }, [collectingChest]);
    const speak = useCallback((label: WorldLabel, cause: "click" | "collision" = "click") => {
        const current = live.current;
        if (current.paused)
            return;
        if (label.kind === "sign") {
            runtime.current?.inspect(label.id);
            setSpeech(null);
            return;
        }
        const n = visits.current.get(label.id) ?? 0;
        visits.current.set(label.id, n + 1);
        residentReactions.set(label.id, { visits: n + 1, at: performance.now() });
        if (cause === "click")
            runtime.current?.inspect(label.id);
        const reply = label.kind === "dragon" ? dragonReply(n) : null;
        if (reply?.swallow && current.onDragonSwallow?.(label.worldX)) {
            runtime.current?.cancelInspection();
            setSpeech(null);
            return;
        }
        setSpeech({
            id: label.id,
            speaker: label.kind === "dragon"
                ? "Le dragon"
                : (ENVIRONMENT_LABELS[label.extra as EnvironmentKind] ??
                    "Une rencontre")
                    .replace(/^(Parler au |Parler à |Parler |Trinquer avec |Réveiller |Taquiner |Appeler |Interrompre |Déranger |Saluer |Observer )/, (prefix) => (prefix === "Parler au " ? "Le " : ""))
                    .replace(/^./, (letter) => letter.toLocaleUpperCase("fr")),
            visit: n,
            text: tr(conversationLine(label.id, label.kind, label.text, n), undefined, uiLocale),
            ...(reply ? { nest: label.worldX } : {}),
        });
    }, [uiLocale]);
    useEffect(() => {
        live.current = props;
    }, [props]);
    useEffect(() => {
        if (!speech || props.paused)
            return;
        const timer = window.setTimeout(() => setSpeech(null), INSPECTION_SECONDS * 1000);
        return () => window.clearTimeout(timer);
    }, [speech, props.paused]);
    useEffect(() => {
        if (!host.current || !labelHost.current)
            return;
        const labels = new WorldLabelLayer(labelHost.current, label => {
            if (live.current.paused)
                return;
            if (label.kind === "hidden")
                live.current.onFindHidden(label.id);
            else
                speak(label);
        });
        try {
            runtime.current = createVoxelWorld(host.current, () => live.current, frame => labels.update(frame, live.current.meId), speak);
            worlds.add(runtime.current);
        }
        catch (reason) {
            live.current.onError?.(reason);
            queueMicrotask(() => setError(true));
        }
        return () => {
            if (runtime.current) {
                runtime.current.dispose();
                worlds.delete(runtime.current);
            }
            runtime.current = null;
            labels.dispose();
        };
    }, [speak]);
    const closeSpeech = () => {
        runtime.current?.cancelInspection();
        setSpeech(null);
    };
    return (<div className="voxel-world" data-renderer="voxel">
      <div className="voxel-world__canvas" ref={host}/>
      {error && (<div className="voxel-error" role="alert">{tr("Le monde voxel n’a pas pu démarrer. Active WebGL 2 dans ton navigateur, puis recharge la page. ", undefined, uiLocale)}</div>)}
      <div className="voxel-labels" ref={labelHost}/>
      <nav className="voxel-camera" aria-label={tr("Caméra du monde", undefined, uiLocale)}>
        <button type="button" aria-label={tr("Tourner la vue à gauche", undefined, uiLocale)} onClick={() => runtime.current?.rotate(-1)}>
          ↶
        </button>
        <span>360°</span>
        <button type="button" aria-label={tr("Tourner la vue à droite", undefined, uiLocale)} onClick={() => runtime.current?.rotate(1)}>
          ↷
        </button>
        <button type="button" aria-label={tr("Rapprocher la caméra", undefined, uiLocale)} onClick={() => runtime.current?.zoom(1)}>
          ＋
        </button>
        <button type="button" aria-label={tr("Éloigner la caméra", undefined, uiLocale)} onClick={() => runtime.current?.zoom(-1)}>
          −
        </button>
        <button type="button" aria-label={tr("Effets de lumière", undefined, uiLocale)} aria-pressed={effects} onClick={() => {
            setEffects(!effects);
            runtime.current?.effects(!effects);
        }}>
          ✧
        </button>
        <button type="button" onClick={() => {
            runtime.current?.recenter();
            props.onReturnToMe?.();
        }}>{tr("Mon personnage ", undefined, uiLocale)}</button>
      </nav>
      {speech && (<Dialogue key={`${speech.id}:${speech.visit}`} text={speech.text} speaker={speech.speaker} paused={props.paused} onClose={closeSpeech}>
          {speech.nest !== undefined && (<button type="button" disabled={!canChallengeDragon(props.meId ? scene.heroes.get(props.meId)?.x : undefined, speech.nest, false) || props.paused} onClick={() => {
                    closeSpeech();
                    props.onDragonChallenge?.();
                }}>{tr("Défier le dragon ", undefined, uiLocale)}</button>)}
        </Dialogue>)}
    </div>);
}
export default memo(VoxelCanvas);
