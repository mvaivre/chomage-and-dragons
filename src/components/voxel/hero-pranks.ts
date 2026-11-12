import * as THREE from "three";
import type { PlayerPranks } from "@/lib/game/powers";
import type { VoxelResources } from "./resources";
import { trollModel } from "./troll";

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

function smokeModel(resources: VoxelResources, height: number): Attachment {
  const root = new THREE.Group(), puffs = Array.from({ length: 6 }, (_, i) => {
    const puff = new THREE.Group();
    const batch = resources.batch(puff);
    batch.box(i % 2 ? 0x615759 : 0x414146, 0, 0, 0, .31, .21, .24);
    batch.box(0x81777a, .09, .05, 0, .18, .12, .20);
    batch.finish();
    root.add(puff);
    return puff;
  });
  return { root, animate: time => puffs.forEach((puff, i) => {
    const p = (time * .55 + i / puffs.length) % 1;
    puff.position.set(Math.sin(p * 5 + i) * (.06 + p * .26), height - .16 + p * 1.12, .08);
    puff.scale.setScalar(.38 + Math.sin(p * Math.PI) * .9);
    puff.rotation.y = p * 3;
  }) };
}

function trollAttachment(resources: VoxelResources, height: number): Attachment {
  const root = new THREE.Group(), troll = trollModel(resources);
  troll.scale.setScalar(.52);
  troll.rotation.x = .28;
  troll.rotation.y = -.30;
  root.add(troll);
  const drops = Array.from({ length: 3 }, () => {
    const drop = new THREE.Group();
    const batch = resources.batch(drop);
    batch.box(0xb0e977, 0, 0, 0, .09, .17, .07, 0, true);
    batch.finish();
    root.add(drop);
    return drop;
  });
  return { root, animate: time => {
    const bob = Math.sin(time * 5) * .04;
    troll.position.set(-.46, height * .53 + bob, -.46);
    troll.userData.animate(time, false);
    drops.forEach((drop, i) => {
      const p = (time * 1.4 + i / drops.length) % 1;
      drop.position.set(-.46 + .20 * p, height * .53 + .84 + bob - .65 * p * p, -.18 + .18 * p);
      drop.scale.setScalar(1 - .55 * p);
    });
  } };
}

const models = { cage: cageModel, smoke: smokeModel, troll: trollAttachment };
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
