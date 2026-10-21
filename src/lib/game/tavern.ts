/** One unique vignette per party; offsets are relative to the entrance. */
export const TAVERN_GUESTS = [
  {id:"wizard",sheet:"b",frame:3,x:250,height:145,label:"Réveiller le mage",lines:["Je ne prends pas un bain, je recharge ma magie.","Ces chopes tiennent mieux debout que moi."]},
  {id:"dancers",sheet:"a",frame:3,x:520,height:185,label:"Encourager les danseurs",lines:["La table a demandé sa démission.","Le prochain solo se joue avec les pieds."]},
  {id:"bard",sheet:"a",frame:1,x:750,height:145,label:"Prévenir le barde",lines:["Le barde trouve sa capuche étrangement chaude.","Il dédie ce morceau à celui qui lui tient les épaules."]},
  {id:"band",sheet:"a",frame:0,x:980,height:175,label:"Écouter le groupe",lines:["Le squelette assure qu’il joue à l’oreille.","Le batteur a perdu le rythme dans son tonneau."]},
  {id:"chandelier",sheet:"a",frame:2,x:1120,height:165,label:"Saluer la cavalière du chandelier",lines:["Elle a réservé une place au balcon.","Le lustre est son seul moyen de transport sobre."]},
  {id:"dragon",sheet:"b",frame:0,x:1250,height:215,label:"Trinquer avec le dragon",lines:["Je crache du feu, mais demain je crains surtout le réveil.","Une dernière et je rentre à pattes."]},
  {id:"handstand",sheet:"b",frame:1,x:1460,height:160,label:"Saluer l’acrobate",lines:["Il attend que le plafond arrête de tourner.","Il prétend que ça fait redescendre la bière."]},
  {id:"kiss",sheet:"b",frame:2,x:1630,height:170,label:"Saluer la princesse et l’ogre",lines:["Elle avait demandé un prince avec du caractère.","L’ogre a oublié le discours, mais gardé la fleur."]},
] as const;

/** Facing opposite the glide gives a moonwalk; flip only at the motionless endpoints. */
export function tavernMoonwalk(seconds:number, reduced=false) {
  if(reduced)return {offset:0,facing:1,frame:0};
  const cycle=seconds%16, forward=cycle<8, leg=cycle%8;
  const progress=Math.min(1,leg/6);
  const eased=progress*progress*(3-2*progress);
  const offset=forward?-42+84*eased:42-84*eased;
  const moving=leg<6;
  return {offset,facing:forward?-1:1,frame:moving?Math.floor(leg*6)%4:0};
}
