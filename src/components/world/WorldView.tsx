"use client";
import { t as tr } from "@/lib/i18n/index";
import { useLocale } from "@/lib/i18n/react";
import { Component, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { rememberWorldMode, type WorldMode } from "@/lib/client/world-mode";
import { worldXFor } from "@/lib/game/world";
import { roomAt } from "@/lib/game/doors";
import { scene } from "../game/scene";
import { setEffectSink } from "../game/fx-queue";
import type { WorldModule, WorldProps } from "./contracts";
import "./world-view.css";
const loaders: Record<WorldMode, () => Promise<WorldModule>> = {
    "2d": () => import("./TwoDimensionalWorld"),
    "3d": () => import("./ThreeDimensionalWorld"),
};
const paint = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
class WorldBoundary extends Component<{
    children: ReactNode;
    onError: (error: unknown) => void;
}, {
    failed: boolean;
}> {
    state = { failed: false };
    static getDerivedStateFromError() { return { failed: true }; }
    componentDidCatch(error: unknown) { this.props.onError(error); }
    render() { return this.state.failed ? null : this.props.children; }
}
/** The game store stays mounted. The old canvas and its resources go away before
 * importing/initialising the next engine; no hidden second world stays alive. */
export function WorldView({ mode, canSwitch, onLoadingChange, onModeChange, onActiveModeChange, ...props }: WorldProps & {
    mode: WorldMode;
    canSwitch: boolean;
    onLoadingChange: (loading: boolean) => void;
    onModeChange: (mode: WorldMode) => void;
    onActiveModeChange: (mode: WorldMode) => void;
}) {
    const uiLocale = useLocale();
    const [mounted, setMounted] = useState<{
        module: WorldModule;
        mode: WorldMode;
        token: number;
        explore: number | null;
    } | null>(null);
    const [phase, setPhase] = useState<"unloading" | "loading" | "ready" | "error">("loading");
    const [retry, setRetry] = useState(0);
    const [readyRevision, setReadyRevision] = useState(0);
    const live = useRef({ props, onLoadingChange, onActiveModeChange, mode });
    const generation = useRef(0), switching = useRef(false), active = useRef<WorldMode | null>(null);
    const moduleRef = useRef<WorldModule | null>(null), lastRelease = useRef<Record<string, number>>({});
    const explore = useRef<number | null>(null);
    const retiring = useRef<Promise<void>>(Promise.resolve());
    const target = mode;
    useEffect(() => { live.current = { props, onLoadingChange, onActiveModeChange, mode }; });
    const fail = useCallback((error: unknown) => {
        console.error("World renderer failed", error);
        generation.current++;
        switching.current = false;
        active.current = null;
        setMounted(null);
        setPhase("error");
        const old = moduleRef.current;
        moduleRef.current = null;
        retiring.current = retiring.current.then(async () => {
            await paint();
            await paint();
            if (old) {
                await old.releaseWorld();
                lastRelease.current = old.worldResources();
            }
            setEffectSink(null);
        }).catch(reason => console.error("World cleanup failed", reason));
        live.current.onLoadingChange(true);
    }, []);
    useEffect(() => {
        if (switching.current || (active.current && !canSwitch) || active.current === target)
            return;
        const token = ++generation.current;
        switching.current = true;
        if (active.current)
            explore.current = scene.exploreCenter ?? (scene.pan ? scene.camera.x + scene.camera.viewW / 2 : null);
        live.current.onLoadingChange(true);
        setPhase("unloading");
        setMounted(null);
        void (async () => {
            // React commits the old renderer's unmount before its module is drained.
            await paint();
            await paint();
            if (generation.current !== token)
                return;
            await retiring.current;
            if (generation.current !== token)
                return;
            const old = moduleRef.current;
            if (old) {
                await old.releaseWorld();
                lastRelease.current = old.worldResources();
            }
            moduleRef.current = null;
            setEffectSink(null);
            if (generation.current !== token)
                return;
            setPhase("loading");
            const next = await loaders[target]();
            if (generation.current !== token)
                return;
            moduleRef.current = next;
            active.current = target;
            setMounted({ module: next, mode: target, token, explore: explore.current });
        })().catch(error => {
            if (generation.current === token)
                fail(error);
        });
    }, [target, canSwitch, retry, readyRevision, fail]);
    useEffect(() => () => {
        generation.current++;
        switching.current = false;
        active.current = null;
        const current = moduleRef.current;
        // Child unmounts and async asset completions are handled by each module.
        void paint().then(() => current?.releaseWorld()).catch(error => console.error("World cleanup failed", error));
        setEffectSink(null);
    }, []);
    useEffect(() => {
        if (!new URLSearchParams(location.search).has("debug"))
            return;
        const host = window as unknown as {
            __worldView?: () => unknown;
        };
        const inspect = () => ({
            mode: active.current, requested: target, phase,
            resources: moduleRef.current?.worldResources() ?? {}, lastRelease: lastRelease.current,
            players: live.current.props.players.map(p => ({ id: p.id, steps: p.journeySteps, x: worldXFor(p.position), room: roomAt(worldXFor(p.position))?.id ?? null })),
            exploreCenter: scene.exploreCenter,
        });
        host.__worldView = inspect;
        return () => {
            if (host.__worldView === inspect)
                delete host.__worldView;
        };
    }, [phase, target]);
    const ready = useCallback(() => {
        if (!mounted)
            return;
        const token = mounted.token;
        if (token === undefined || generation.current !== token)
            return;
        void paint().then(() => {
            if (generation.current !== token)
                return;
            if (!switching.current) {
                live.current.props.onSceneReady();
                return;
            }
            switching.current = false;
            rememberWorldMode(mounted.mode);
            live.current.onActiveModeChange(mounted.mode);
            setReadyRevision(n => n + 1);
            setPhase("ready");
            live.current.props.onSceneReady();
            live.current.onLoadingChange(false);
        });
    }, [mounted]);
    useEffect(() => {
        if (phase === "ready" || phase === "error")
            return;
        const timer = setTimeout(() => fail(new Error("World loading timed out")), 45000);
        return () => clearTimeout(timer);
    }, [phase, fail]);
    const Canvas = mounted?.module.default;
    return <div className="world-view" data-mode={mounted?.mode ?? target} data-state={phase} aria-busy={phase !== "ready"}>
    {Canvas && mounted ? <WorldBoundary key={mounted.token} onError={fail}><Canvas key={props.meId ?? "preview"} {...props} initialExploreCenter={mounted.explore} onSceneReady={ready} onError={fail}/></WorldBoundary> : null}
    {phase !== "ready" ? <div className="world-loader" role={phase === "error" ? "alert" : "status"} aria-live="polite">
      <div className="world-loader__card">
        <span className="world-loader__sigil" aria-hidden="true">✦</span>
        <strong>{tr(phase === "error" ? "Ce monde n’a pas pu s’ouvrir" : `Voyage vers le monde ${target.toUpperCase()}`, undefined, uiLocale)}</strong>
        <p>{tr(phase === "error" ? "Ta partie est conservée. Tu peux réessayer ou choisir la vue 2D." : phase === "unloading" ? "On range le paysage…" : "Le paysage prend forme…", undefined, uiLocale)}</p>
        {phase === "error" ? <div><button type="button" onClick={() => { setRetry(n => n + 1); }}>{tr("Réessayer", undefined, uiLocale)}</button><button type="button" onClick={() => { onModeChange("2d"); setRetry(n => n + 1); }}>{tr("Ouvrir en 2D", undefined, uiLocale)}</button></div> : <span className="world-loader__progress" aria-hidden="true"/>}
      </div>
    </div> : null}
    {phase === "ready" && mounted?.mode !== target ? <p className="world-switch-pending" role="status">{tr("La vue changera à la fin de ce moment.", undefined, uiLocale)}</p> : null}
  </div>;
}
