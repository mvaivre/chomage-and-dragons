import type { ActionKind, PowerKind, MiniGameKind } from "@/lib/data/types";
import type { VoxelIconName } from "./voxel-icons";

/** One procedural voxel vocabulary, shared by every UI surface. */
export const ACTION_ICONS: Record<ActionKind,VoxelIconName>={candidature:'pigeon',refus:'refusal',entretien:'interview',rejetApresEntretien:'stamp',embauche:'castle'};
export const POWER_ICONS: Record<PowerKind,VoxelIconName>={shot:'mug',feuSacré:'fire',fienteDragon:'dragon',paperasse:'papers',crapaud:'frog'};
export const GAME_ICONS: Record<MiniGameKind,VoxelIconName>={dragon:'dragon',pigeon:'pigeon',keywords:'scroll',stamp:'stamp',quiz:'crystal',ghosting:'ghost',slots:'coins',pigeonRace:'flag',paperCut:'sword',snake:'snake',maze:'lamp',stack:'stack',pong:'paddle'};
