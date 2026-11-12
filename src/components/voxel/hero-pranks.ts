import * as THREE from "three";
import type { PlayerPranks } from "@/lib/game/powers";
import type { VoxelResources } from "./resources";

type Status = keyof PlayerPranks;
type Attachment = { root: THREE.Group; animate?: (time: number) => void };
export type HeroPrankAttachments = Partial<Record<Status, Attachment>>;

function cageModel(resources: VoxelResources, height: number): Attachment {
  const root = new THREE.Group();
  const top = height + .19, width = .9, depth = .67;
  const bars = resources.batch(root);
  for (const z of [-depth, depth]) {
    for (const x of [-width, -.31, .31, width]) {
      bars.box(0x687675, x, top / 2, z, .065, top, .065);
    }
    for (const y of [.07, top]) bars.box(0x485454, 0, y, z, width * 2 + .1, .1, .11);
  }
  for (const x of [-width, width]) {
    bars.box(0x687675, x, top / 2, 0, .065, top, .065);
    for (const y of [.07, top]) bars.box(0x485454, x, y, 0, .11, .1, depth * 2);
  }
  bars.box(0x876333, .31, top * .55, depth + .06, .25, .28, .12);
  bars.box(0x2d2522, .31, top * .55, depth + .125, .055, .12, .015);
  bars.finish();
  return { root };
}

function fireModel(resources: VoxelResources, height: number): Attachment {
  const root = new THREE.Group();
  root.name = "hero-flame";
  const flames = [-1, 0, 1].map((side) => {
    const tongue = new THREE.Group();
    tongue.position.set(side * .25, height - .15, side === 0 ? -.08 : .09);
    const fire = resources.batch(tongue);
    const reach = side === 0 ? 1 : .72;
    fire.box(0xd63f1c, 0, .15, 0, .53, .34, .48, 0, true);
    fire.box(0xff7424, 0, .34 * reach, 0, .43, .52 * reach, .39, side * -.14, true);
    fire.box(0xffa92e, .06 * side, .60 * reach, -.03, .27, .38 * reach, .28, side * -.22, true);
    fire.box(0xf85c22, .12 * side, .84 * reach, -.08, .14, .24 * reach, .17, side * -.35, true);
    fire.box(0xffe994, -.02, .23, .17, .22, .38 * reach, .22, 0, true);
    fire.finish();
    root.add(tongue);
    return tongue;
  });
  const puffs = Array.from({ length: 5 }, (_, i) => {
    const puff = new THREE.Group();
    const batch = resources.batch(puff);
    batch.box(i % 2 ? 0x615759 : 0x414146, 0, 0, 0, .31, .21, .24);
    batch.box(0x81777a, .09, .05, 0, .18, .12, .20);
    batch.finish();
    root.add(puff);
    return puff;
  });
  const embers = Array.from({ length: 5 }, () => {
    const ember = new THREE.Group();
    const batch = resources.batch(ember);
    batch.box(0xffbd46, 0, 0, 0, .06, .11, .06, 0, true);
    batch.finish();
    root.add(ember);
    return ember;
  });
  return { root, animate: time => {
    flames.forEach((tongue, i) => {
      tongue.scale.y = 1 + .15 * Math.sin(time * 11 + i * 2.1);
      tongue.rotation.z = .12 * Math.sin(time * 8 + i * 1.7);
    });
    puffs.forEach((puff, i) => {
      const p = (time * .62 + i / puffs.length) % 1;
      puff.position.set(Math.sin(p * 5 + i) * (.12 + p * .34), height + .45 + p * 1.13, -.15);
      puff.scale.setScalar(.35 + Math.sin(p * Math.PI) * .85);
      puff.rotation.y = p * 3;
    });
    embers.forEach((ember, i) => {
      const p = (time * 1.2 + i / embers.length) % 1;
      ember.position.set(Math.sin(i * 4.2 + p * 2) * (.28 + p * .4), height + p * 1.48, .21);
      ember.scale.setScalar(1 - .75 * p);
    });
  } };
}

function trollAttachment(resources: VoxelResources, height: number): Attachment {
  const root = new THREE.Group(), troll = new THREE.Group(), head = new THREE.Group();
  root.name = "backpack-troll";
  const skin = 0x90ab41, light = 0xb6c653, shade = 0x657b30;
  const body = resources.batch(troll);
  body.box(0xa54c34, 0, .35, -.03, .66, .62, .58);
  body.box(0xca6d45, 0, .30, .29, .67, .16, .09, -.19);
  body.box(0xe5b957, -.13, .28, .34, .20, .18, .10);
  body.box(0x633c2c, -.13, .28, .405, .105, .09, .02);
  for (const side of [-1, 1]) {
    body.box(shade, side * .23, -.04, .05, .19, .31, .24, side * .16);
    body.box(skin, side * .23, -.18, .16, .23, .17, .29);
  }
  body.box(skin, .37, .43, .21, .46, .19, .24, -.16);
  body.box(light, .61, .44, .23, .17, .22, .23);
  body.finish();
  troll.add(head);
  head.position.y = .68;
  const face = resources.batch(head);
  face.box(shade, 0, .30, -.065, .94, .73, .64);
  face.box(skin, 0, .29, .135, .88, .68, .51);
  face.box(light, 0, .14, .34, .78, .26, .32);
  face.box(0xae7340, .05, .36, .46, .30, .22, .25);
  face.box(0x863b24, -.12, .70, .02, .53, .17, .40, -.17);
  face.box(0xb65f30, .14, .78, .0, .22, .20, .25, -.30);
  face.box(0x462d22, .05, .09, .515, .55, .12, .045);
  for (const side of [-1, 1]) {
    face.box(skin, side * .59, .40, -.04, .38, .25, .26, side * .42);
    face.box(0xb37442, side * .65, .43, .09, .22, .13, .07, side * .42);
    face.box(0xffe8b7, side * .27, .115, .54, .13, .24, .125, side * -.22);
  }
  face.finish();
  const eyes = new THREE.Group(), eyeBatch = resources.batch(eyes);
  for (const side of [-1, 1]) {
    eyeBatch.box(0xffefb9, side * .225, .455, .407, .24, .22, .12);
    eyeBatch.box(0x312419, side * .225 + .045, .45, .479, .088, .12, .04);
  }
  eyeBatch.finish();
  const tongue = new THREE.Group(), tongueBatch = resources.batch(tongue);
  tongue.position.set(.11, .06, .53);
  tongueBatch.box(0x9bdb3b, .05, -.06, .12, .28, .13, .32, -.22);
  tongueBatch.box(0xd3f367, .11, -.12, .31, .17, .09, .14, -.38);
  tongueBatch.finish();
  head.add(eyes, tongue);
  root.add(troll);
  const drops = Array.from({ length: 5 }, () => {
    const drop = new THREE.Group();
    const batch = resources.batch(drop);
    batch.box(0xb0e977, 0, 0, 0, .09, .17, .07, 0, true);
    batch.finish();
    root.add(drop);
    return drop;
  });
  return { root, animate: time => {
    const beat = time % 3;
    const spit = beat > 1.83 && beat < 2.5;
    const bob = Math.sin(time * 6) * .065;
    troll.position.set(-.84, height * .51 + bob, -.36);
    troll.rotation.z = -.14 + Math.sin(time * 3) * .09;
    head.rotation.x = spit ? -.20 : Math.sin(time * 4) * .09;
    head.rotation.y = .24 + Math.sin(time * 2) * .12;
    eyes.scale.y = beat > 1.52 && beat < 1.82 ? .26 : 1;
    eyes.position.y = .45 * (1 - eyes.scale.y);
    tongue.scale.z = spit ? 1.35 : .42;
    drops.forEach((drop, i) => {
      const p = (time * 1.4 + i / drops.length) % 1;
      drop.position.set(troll.position.x + .22 + (spit ? .79 : .22) * p, troll.position.y + .75 - .89 * p * p, .22 + .22 * p);
      drop.scale.setScalar((spit ? 1.15 : .8) * (1 - .52 * p));
    });
  } };
}

const models = { cage: cageModel, smoke: fireModel, troll: trollAttachment };
const statuses: Status[] = ["cage", "smoke", "troll"];

export function updateHeroPranks(resources: VoxelResources, hero: THREE.Group, height: number, attachments: HeroPrankAttachments, pranks: PlayerPranks | undefined, time: number) {
  for (const status of statuses) {
    const attachment = attachments[status];
    if (pranks?.[status]) {
      const model = attachment ?? models[status](resources, height);
      if (!attachment) {
        hero.add(model.root);
        attachments[status] = model;
      }
      model.animate?.(time);
    } else if (attachment) {
      resources.release(attachment.root);
      delete attachments[status];
    }
  }
}
