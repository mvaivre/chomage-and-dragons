"use client";
import dynamic from "next/dynamic";
import { useExperience } from "@/components/world/ExperienceContext";
import type { EncounterModel } from "@/lib/game/encounter-models";
import type { MiniGameKind } from "@/lib/data/types";
import { GameArtwork } from "./Artwork";
const VoxelEncounterArtwork = dynamic(() => import("./VoxelEncounterArtwork").then(module => module.VoxelEncounterArtwork));

/** Flat ink-and-paper creatures for the 2D world, reveals and capture journal. */
export function EncounterArtwork({ model, rare = false, className = "" }: { model: EncounterModel; rare?: boolean; className?: string ;
}) {
  const experience = useExperience();
    if (experience === "3d")
        return <VoxelEncounterArtwork model={model} rare={rare} className={className}/>;
    const paper = rare ? "#f1ce76" : "#efe4c7", ink = "#293c38";
  const eyes = <g fill={ink} stroke="none"><ellipse cx="51" cy="48" rx="3" ry="5" /><ellipse cx="77" cy="48" rx="3" ry="5" />{model !== "doubt" ? <path d="M56 64q8 6 16 0v3q-8 7-16 0z" /> : null}</g>;
  const feet = <g fill={ink}><path d="M41 97v12h-9q-7 8 3 8h21V97M73 97v20h21q9-9-7-8V97" /></g>;
  const figure = (() => {
    switch (model) {
      case "cv": case "refusal": return <>{feet}<path d="m25 62-13 10 9 5 10-5m70-10 13 10-9 5-10-5" fill={paper} /><path d="M32 12h53l15 16-5 75-64-3z" fill={paper} /><path d="m85 12-2 17 17-1M43 78h40m-40 9h28" fill="none" />{eyes}{model === "refusal" ? <g stroke="#ac554d"><circle cx="81" cy="87" r="11" fill="#b96658" /><path d="m75 81 12 12m0-12L75 93" stroke={paper} /></g> : null}</>;
      case "orp": return <>{feet}<path d="M37 59q-11 9-13 38h79q-2-28-14-38" fill={rare ? "#b7bc88" : "#7297a1"} /><path d="M42 60V27q22-21 44 0v33q-22 16-44 0" fill="#dbb58e" /><path d="M39 32q-1-29 26-20 26-4 26 21L78 23l-8 9-12-9z" fill="#9b9b89" /><path d="m61 70-5 21 9 7 8-7-7-21" fill="#b96658" /><rect x="9" y="68" width="31" height="36" rx="2" fill={paper} /><path d="M16 79h17m-17 8h12" />{eyes}</>;
      case "chair": return <><path d="M64 83v25m-29 7 29-7 30 7m-30-7v10" fill="none" strokeWidth="7" /><rect x="33" y="12" width="62" height="66" rx="18" fill={rare ? "#91ad82" : "#ac7c94"} /><path d="M28 80q36-14 72 0v12H28z" fill={rare ? "#a6bb94" : "#c79bad"} /><path d="M17 67v19h16m78-19v19H96" fill="none" strokeWidth="6" />{eyes}</>;
      case "coffee": return <>{feet}<path d="M89 40h15q27 27-3 43H89" fill="none" stroke="#e6d7ae" strokeWidth="10" /><path d="M28 31h65l-5 66q-30 15-56 0z" fill={rare ? "#9fbba8" : "#d3b182"} /><ellipse cx="60" cy="32" rx="33" ry="8" fill="#624b3b" /><path d="M47 20q-9-8 0-15m20 15q-9-8 0-15m17 15q-9-8 0-15" fill="none" stroke="#a5b59a" />{eyes}</>;
      case "doubt": return <><path d="M14 99q15-17 12-33-11-34 14-44Q67-4 91 26q35 9 13 42-2 13 12 32-18 11-29 0-12 15-25 0-17 16-29 0-10 12-19-1" fill={rare ? "#a4adbf" : "#a497b8"} />{eyes}<path d="M54 69q10-7 20 0" fill="none" /></>;
      case "ai": return <>{feet}<path d="M27 67 10 80l12 17m79-30 17 13-12 17M64 21V7" fill="none" strokeWidth="7" /><rect x="25" y="23" width="78" height="77" rx="11" fill={rare ? "#d2b46e" : "#80a9a0"} /><rect x="34" y="33" width="60" height="44" rx="6" fill={ink} /><g fill="#b8dfb9" stroke="none"><circle cx="49" cy="48" r="5" /><circle cx="79" cy="48" r="5" /><path d="M52 63h24v3H52z" /></g><circle cx="64" cy="9" r="6" fill="#b96658" /><path d="M43 87h25m9 0h7" />{rare ? <circle cx="91" cy="28" r="8" fill="#b96658" /> : null}</>;
      case "ball": return <><circle cx="64" cy="64" r="40" fill={paper} /><path d="M24 64a40 40 0 0 1 80 0z" fill="#b96658" /><path d="M24 64h80" strokeWidth="7" /><circle cx="64" cy="64" r="13" fill="#d8b568" /><circle cx="64" cy="64" r="6" fill={paper} /></>;
      default: return null;
    }
  })();
  if (!figure) return <span className={`encounter-artwork ${className}`} data-encounter-model={model}><GameArtwork kind={model as MiniGameKind}/></span>;
    return <svg viewBox="0 0 128 128" className={`encounter-artwork ${className}`} data-encounter-model={model} aria-hidden="true" focusable="false" stroke={ink} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round">{figure}{rare ? <path d="m111 7 3 8 8 3-8 3-3 8-3-8-8-3 8-3z" fill="#f4d57a" strokeWidth="1"/> : null}</svg>;
}
