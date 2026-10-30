import * as THREE from "three";
import { chestPickup } from "./chest";
import { stampCrushPose } from "./stamp-crush";
import { propModel, dragonModel } from "./objects";
import { VoxelResources } from "./resources";
import { reactionTiming, type EffectKind } from "./reactions";

/** Every saved variant has its own staging, using the shared procedural props. */
export function createReaction(
  resources: VoxelResources,
  kind: EffectKind,
  dragonVariant = "green",
  stampCrush = kind === "legendary",
) {
  if (kind === "chest") return chestPickup(resources);
  const root = new THREE.Group(),
    props: THREE.Group[] = [];
  const { box, finish } = resources.batch(root);
  const add = (model: string, count = 1) => {
    for (let i = 0; i < count; i++) {
      const prop =
        model === "dragon"
          ? dragonModel(resources, dragonVariant)
          : propModel(resources, model);
      root.add(prop);
      props.push(prop);
    }
  };
  switch (kind) {
    case "pigeon":
    case "pigeonDive":
    case "pigeonRocket":
      add("pigeon");
      add("letter");
      break;
    case "pigeonSquadron":
      add("pigeon", 5);
      break;
    case "pigeonAscension":
      add("pigeon", 8);
      add("crown");
      break;
    case "pigeonReceipt":
      add("pigeon");
      add("letter");
      add("stamp");
      break;
    case "sealedLetter":
    case "formLetter":
      add("letter");
      break;
    case "legendary":
      add("stamp");
      break;
    case "lightning":
      add("lightning");
      break;
    case "storm":
      add("cloud", 3);
      add("lightning", 3);
      break;
    case "coldShower":
      add("cloud");
      for (let i = 0; i < 28; i++)
        box(
          0x9bc5cc,
          Math.sin(i * 23) * 1.1,
          i * 0.12,
          Math.cos(i * 13) * 0.7,
          0.045,
          0.22,
          0.045,
        );
      break;
    case "slammedDoor":
      add("door");
      break;
    case "bigNo":
      add("non");
      break;
    case "refusalAvalanche":
      add("letter", 18);
      break;
    case "mythicRejection":
      add("letter", 47);
      break;
    case "paperStorm":
      add("letter", 24);
      break;
    case "cocktail":
    case "coffee":
      add("cup");
      break;
    case "cocktailFireworks":
      add("cup", 7);
      break;
    case "spotlight": {
      add("lamp", 2);
      const light = resources.pointLight(0xffdc97, 25, 9);
      light.position.y = 3;
      root.add(light);
      break;
    }
    case "redCarpet":
      add("cup", 2);
      for (let i = 0; i < 20; i++)
        box(
          i % 2 ? 0x985458 : 0xa8635c,
          (i - 10) * 0.35,
          0.03,
          0,
          0.36,
          0.05,
          1.8,
        );
      break;
    case "gnomeBand":
      add("gnome", 5);
      add("cup", 5);
      break;
    case "anvil":
      add("anvil");
      break;
    case "meteor":
      add("meteor");
      break;
    case "frogReader":
      add("frog");
      add("letter");
      break;
    case "frogCurse":
      add("frog");
      break;
    case "trophy":
      add("trophy");
      break;
    case "grandFireworks":
      add("crown");
      for (let i = 0; i < 55; i++)
        box(
          [0xe9bd74, 0xe9a6aa, 0x93d9d2][i % 3],
          Math.sin(i * 21) * 3,
          Math.abs(Math.cos(i * 31)) * 4,
          Math.cos(i * 11) * 2,
          0.09,
          0.15,
          0.09,
          0,
          true,
        );
      break;
    case "shotVolley":
      add("shot", 6);
      break;
    case "fireCurse":
      add("fire", 5);
      break;
    case "dragonDrop":
    case "dragonMeal":
      add("dragon");
      add("poop");
      break;
  }
  const stamp = stampCrush
    ? kind === "legendary"
      ? props[0]
      : propModel(resources, "stamp")
    : null;
  if (stamp && kind !== "legendary") root.add(stamp);
  if (stamp) stamp.name = "crushing-stamp";
  finish();
  const timing = reactionTiming(kind, stampCrush),
    impact = timing.impact / timing.duration;
  return {
    root,
    update(u: number, elapsed: number, heroHeight = 2) {
      const beat = Math.max(0, (u - impact) / (1 - impact)),
        fall = Math.min(1, u / impact);
      root.position.set(0, 0, 0);
      root.rotation.set(0, 0, 0);
      root.scale.setScalar(1);
      props.forEach((p, i) => {
        p.position.set(0, 0, 0);
        p.rotation.set(0, 0, 0);
        p.visible = true;
        p.scale.setScalar(1);
        const side = i % 2 ? 1 : -1;
        switch (kind) {
          case "pigeon":
          case "pigeonDive":
          case "pigeonRocket":
          case "pigeonReceipt": {
            if (i === 0) {
              p.position.set(
                (u - 0.4) * 16,
                kind === "pigeonDive"
                  ? 1 + Math.abs(u - 0.4) * 9
                  : 2 + Math.sin(u * 9) * 0.2,
                0,
              );
              p.rotation.z = kind === "pigeonDive" ? 0.45 : 0;
              p.rotation.y = -Math.PI / 2;
            } else if (i === 1) {
              p.position.set(beat * 3, 1.2 + Math.sin(u * 6) * 0.4, 0);
              p.rotation.z = beat * 0.7;
            } else {
              p.position.set(1, 3 * (1 - fall) + 1, 0);
              p.scale.setScalar(1.5);
            }
            break;
          }
          case "pigeonSquadron":
            p.position.set(
              (u - 0.4) * 14 - i * 0.6,
              2 + i * 0.18,
              side * i * 0.35,
            );
            p.rotation.y = -Math.PI / 2;
            break;
          case "pigeonAscension":
            if (i < 8) {
              p.position.set(
                Math.cos(i * 0.9 + u * 5) * (1 + u),
                1 + u * 6 + i * 0.15,
                Math.sin(i * 0.9 + u * 5) * (1 + u),
              );
            } else {
              p.position.y = 2.4 + u * 4;
            }
            break;
          case "sealedLetter":
          case "formLetter":
            p.position.set(-2 + fall * 2, 1.6, 0);
            p.rotation.z = Math.sin(elapsed * 3) * 0.1;
            break;
          case "lightning":
            p.position.y = 1.8 + (1 - fall) * 4;
            p.scale.y = beat > 0.3 ? 0.1 : 2.5;
            break;
          case "storm":
            p.position.set(
              Math.sin(i * 17) * 1.7,
              i < 3 ? 3.5 : 1.6,
              Math.cos(i * 9),
            );
            p.visible = i < 3 || Math.sin(elapsed * 19 + i) > 0;
            break;
          case "coldShower":
            p.position.y = 3.5;
            root.position.y = -(elapsed % 1) * 0.25;
            break;
          case "slammedDoor":
            p.position.set(0.9, 0, 0);
            p.rotation.y = ((1 - fall) * Math.PI) / 2;
            p.scale.setScalar(1.5);
            break;
          case "bigNo":
            p.position.y = 1.6;
            p.scale.setScalar(Math.min(2.5, fall * 3));
            break;
          case "refusalAvalanche":
          case "mythicRejection":
          case "paperStorm":
            p.position.set(
              Math.sin(i * 47 + u * 4) * (1.5 + i * 0.04),
              (((i * 0.31 + 4 - u * 7) % 5) + 5) % 5,
              Math.cos(i * 17 + u * 4) * 1.6,
            );
            p.rotation.set(u * 3, i * 0.6, u * 4 + i);
            p.scale.setScalar(0.65);
            break;
          case "legendary":
            break;
          case "anvil":
          case "meteor":
            p.position.set(
              0,
              (1 - fall) * 7 + Math.sin(beat * Math.PI) * 0.35,
              0,
            );
            p.scale.setScalar(kind === "meteor" ? 2.8 : 1.6);
            break;
          case "cocktail":
          case "coffee":
            p.position.set(1, 1.3 + Math.sin(u * Math.PI) * 0.6, 0);
            p.rotation.z = Math.sin(u * Math.PI) * -0.5;
            break;
          case "spotlight":
            p.position.set(side * 2.5, 2, 0);
            p.rotation.z = side * 0.5;
            break;
          case "redCarpet":
            p.position.set(side * 1.5, 1.4, 0);
            root.scale.x = Math.min(1, u * 4);
            break;
          case "cocktailFireworks":
          case "shotVolley":
            p.position.set(
              Math.cos(i * 1.1 + u * 5) * 2,
              1.2 + Math.sin(u * Math.PI) * 2 + i * 0.1,
              Math.sin(i * 1.1 + u * 5) * 2,
            );
            p.rotation.z = Math.sin(u * 7 + i) * 0.3;
            break;
          case "gnomeBand": {
            const n = i % 5;
            p.position.set(
              (n - 2) * 1,
              i < 5 ? Math.abs(Math.sin(elapsed * 8 + n)) * 0.18 : 1.2,
              -1.8,
            );
            if (i >= 5) p.scale.setScalar(0.55);
            break;
          }
          case "frogReader":
            p.position.set(
              i === 0 ? 0.8 : 1.2,
              i === 0 ? Math.abs(Math.sin(elapsed * 4)) * 0.15 : 0.5,
              0,
            );
            p.scale.setScalar(i === 0 ? 1.8 : 0.7);
            break;
          case "frogCurse":
            p.position.y = Math.abs(Math.sin(elapsed * 5)) * 0.3;
            p.scale.setScalar(2);
            break;
          case "fireCurse":
            p.position.set(
              Math.cos(i * 1.3) * 0.8,
              0.2 + Math.sin(elapsed * 10 + i) * 0.15,
              Math.sin(i * 1.3) * 0.8,
            );
            break;
          case "dragonDrop":
          case "dragonMeal":
            if (i === 0) {
              p.position.set(
                kind === "dragonMeal" ? 2 : 8 - u * 16,
                kind === "dragonMeal" ? 0 : 4,
                0,
              );
              p.rotation.y = -Math.PI / 2;
              p.scale.setScalar(1.25);
            } else {
              p.visible = beat > 0.4;
              p.position.set(-1, 0, 0);
            }
            break;
          default:
            p.position.y = 2 + Math.sin(u * Math.PI) * 0.6;
            p.rotation.y = u * 2;
        }
      });
      if (stamp) {
        const pose = stampCrushPose(elapsed);
        // Variant props remain visible beside the central stamp, never through the hero.
        if (kind !== "legendary")
          for (const prop of props) {
            prop.position.x -= 2.6;
            prop.position.z -= 0.6;
            prop.scale.multiplyScalar(0.65);
          }
        stamp.visible = pose.stampVisible;
        stamp.scale.set(2.6, 3, 1.9);
        stamp.position.set(0, heroHeight * pose.y + 0.025 + pose.stampLift, 0);
        stamp.rotation.set(0, 0, 0);
        root.userData.stampPose = pose;
      }
      if (kind === "grandFireworks") root.scale.setScalar(0.2 + beat * 1.5);
    },
  };
}
