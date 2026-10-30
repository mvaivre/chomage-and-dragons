import { characterArt } from "@/lib/game/characters";
import { ChestArtwork, PowerArtwork } from "../Artwork";

/** Small illustrated stages reuse the game's approved scenery and characters. */
export function InitiationScene({ scene, characterId, steps = 0, chestOpen = false, powerCast = false, label }: {
  scene: "road" | "treasure" | "company"; characterId: string; steps?: number;
  chestOpen?: boolean; powerCast?: boolean; animated?: boolean; label: string;
}) {
  return <div className="initiation-scene" data-scene={scene} data-walked={steps > 0} data-open={chestOpen} data-cast={powerCast} role="img" aria-label={label}>
    <div className="initiation-scene__landscape" />
    <div className="initiation-scene__path" />
    {/* eslint-disable-next-line @next/next/no-img-element -- same optimized illustration as the game */}
    <img className="initiation-scene__hero" src={characterArt(characterId)} alt="" draggable={false} />
    {scene === "treasure" ? <>
      <ChestArtwork className="initiation-scene__chest" />
      {chestOpen ? <PowerArtwork kind="crapaud" className="initiation-scene__power" /> : null}
    </> : null}
    {scene === "company" || scene === "treasure" ? <div className="initiation-scene__friend">
      {powerCast ? <PowerArtwork kind="crapaud" /> :
        // eslint-disable-next-line @next/next/no-img-element -- shared local character artwork
        <img src={characterArt(characterId === "chevalier" ? "barde" : "chevalier")} alt="" draggable={false} />}
    </div> : null}
    {scene === "road" ? <span className="initiation-scene__milestone" aria-hidden="true">{steps > 0 ? "+2" : "0"}<small>pas</small></span> : null}
  </div>;
}
