export type HeroMotion = "idle" | "walk" | "send" | "hurt" | "celebrate";

/** Pose changes are independent of the rendering framerate and the direction of travel. */
export function heroFrame(motion: HeroMotion, time: number, progress = 0): number {
  if (motion === "walk") return [2, 3, 4, 5][Math.floor(time * 9) % 4];
  if (motion === "send") return [6, 7, 8][Math.min(2, Math.floor(progress * 3))];
  if (motion === "hurt") return [9, 10, 11, 10][Math.min(3, Math.floor(progress * 4))];
  if (motion === "celebrate") return [12, 13, 14, 15][Math.min(3, Math.floor(progress * 4))];
  return time % 4.7 > 4.5 ? 1 : 0;
}

/** Keep each class's props consistent; reject the three generated victory poses with stray props. */
export function characterFrame(characterId: string, motion: HeroMotion, time: number, progress = 0): number {
  const frame = heroFrame(motion === "idle" && characterId === "fee" ? "walk" : motion, time, progress);
  return frame === 14 && ["skater", "sorciere", "druidesse"].includes(characterId) ? 13 : frame;
}

/** These source poses were drawn looking left; travel and reactions already face right. */
export function poseFacing(characterId: string, frame: number): 1 | -1 {
  return characterId === "squelette" && [0, 1, 15].includes(frame) ? -1 : 1;
}

const poseSheet = (id: string, referenceHeight: number) => ({
  url: `/art/world-v3/animations/${id}.webp`, columns: 4, rows: 4,
  referenceHeight, height: 320, baseline: 312,
});

export const CHARACTER_ANIMATIONS: Partial<Record<string, ReturnType<typeof poseSheet>>> = {
  archimage: poseSheet("archimage", 295),
  barde: poseSheet("barde", 272),
  chevalier: poseSheet("chevalier", 296),
  demon: poseSheet("demon", 261),
  druidesse: poseSheet("druidesse", 247),
  fee: poseSheet("fee", 263),
  licorne: poseSheet("licorne", 256),
  necromancien: poseSheet("necromancien", 264),
  paladin: poseSheet("paladin", 264),
  skater: poseSheet("skater", 266),
  sorciere: poseSheet("sorciere", 292),
  squelette: poseSheet("squelette", 275),
  teddy: poseSheet("teddy", 236),
  vampire: poseSheet("vampire", 216),
  voleur: poseSheet("voleur", 289),
};
