"use client";

import { useEffect, useMemo, useState } from "react";
import { Rectangle, Texture } from "pixi.js";

/** Un atlas partagé évite un téléchargement et une texture GPU par classe. */
const ATLAS_URL = "/art/runtime/adventurers.webp";
interface ActionSheet {
  url: string;
  columns: number;
  rows: number;
  /** Orientation dessinée dans la feuille, indépendante du déplacement en jeu. */
  nativeFacing?: "left" | "right";
  /** Première des huit cellules du personnage dans un atlas partagé. */
  offset?: number;
  /** Certaines feuilles fines dépassent les huit poses historiques. */
  frameCount?: number;
}

const ACTION_SHEETS: Partial<Record<string, ActionSheet>> = {
  voleur: {
    url: "/art/runtime/rogue-animation.webp",
    columns: 6,
    rows: 4,
    frameCount: 24,
  },
  skater: {
    url: "/art/runtime/skater-animation.webp",
    columns: 6,
    rows: 4,
    frameCount: 24,
    nativeFacing: "left",
  },
  fee: { url: "/art/runtime/fairy-actions.webp", columns: 4, rows: 2 },
  licorne: {
    url: "/art/runtime/unicorn-skeleton-actions.webp",
    columns: 4,
    rows: 4,
  },
  squelette: {
    url: "/art/runtime/unicorn-skeleton-actions.webp",
    columns: 4,
    rows: 4,
    offset: 8,
  },
  demon: {
    url: "/art/runtime/demon-vampire-actions.webp",
    columns: 4,
    rows: 4,
  },
  vampire: {
    url: "/art/runtime/demon-vampire-actions.webp",
    columns: 4,
    rows: 4,
    offset: 8,
  },
  teddy: {
    url: "/art/runtime/teddy-bard-actions.webp",
    columns: 4,
    rows: 4,
  },
  barde: {
    url: "/art/runtime/teddy-bard-actions.webp",
    columns: 4,
    rows: 4,
    offset: 8,
  },
  sorciere: {
    url: "/art/runtime/sorceress-actions.webp",
    columns: 4,
    rows: 2,
  },
  chevalier: {
    url: "/art/runtime/knight-actions.webp",
    columns: 4,
    rows: 2,
  },
};

const JUMP_SHEETS: Partial<Record<string, ActionSheet>> = {
  skater: {
    url: "/art/runtime/skater-jump.webp?v=1",
    columns: 6,
    rows: 2,
    frameCount: 12,
    nativeFacing: "right",
  },
};

/** Sens intrinsèque de l'illustration ; le héros applique ensuite le sens du voyage. */
export function characterNativeFacing(characterId: string): "left" | "right" {
  return ACTION_SHEETS[characterId]?.nativeFacing ?? "right";
}

export function characterJumpNativeFacing(characterId: string): "left" | "right" {
  return JUMP_SHEETS[characterId]?.nativeFacing ?? characterNativeFacing(characterId);
}
const ATLAS_INDEX: Partial<Record<string, number>> = {
  barde: 0,
  sorciere: 1,
  chevalier: 2,
  voleur: 3,
  druidesse: 4,
  licorne: 5,
  squelette: 6,
  fee: 7,
  demon: 8,
  vampire: 9,
};

const CACHE = new Map<string, Texture | null>();
const PENDING = new Map<string, Promise<Texture | null>>();
const KEY_TOLERANCE = 78;

/** Détoure le fond magenta uniforme de l'atlas généré. */
function keyOut(image: HTMLImageElement, preserveTopLeft = false): Texture {
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return Texture.from(image);

  ctx.drawImage(image, 0, 0);
  const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const pixels = frame.data;

  for (let index = 0; index < pixels.length; index += 4) {
    const pixel = index / 4;
    const x = pixel % canvas.width;
    const y = Math.floor(pixel / canvas.width);
    if (
      preserveTopLeft &&
      x < canvas.width * 0.5 &&
      y < canvas.height * 0.5
    ) {
      continue;
    }

    const distance = Math.hypot(
      255 - pixels[index],
      pixels[index + 1],
      255 - pixels[index + 2],
    );

    if (distance < KEY_TOLERANCE) {
      pixels[index + 3] = 0;
    } else if (distance < KEY_TOLERANCE * 2) {
      const edge = (distance - KEY_TOLERANCE) / KEY_TOLERANCE;
      pixels[index + 3] = Math.round(pixels[index + 3] * edge);
      pixels[index] = Math.min(pixels[index], pixels[index + 1] + 40);
      pixels[index + 2] = Math.min(pixels[index + 2], pixels[index + 1] + 40);
    }

    // Une arête sombre mélangée à un fond rose peut être loin du magenta pur
    // tout en gardant une vilaine frange violette. On retire ce débordement sans
    // toucher aux rouges et aux bleus francs (les deux canaux doivent dominer).
    const green = pixels[index + 1];
    const magentaBias = Math.min(pixels[index], pixels[index + 2]) - green;
    if (magentaBias > 26) {
      pixels[index] = Math.min(pixels[index], green + 28);
      pixels[index + 2] = Math.min(pixels[index + 2], green + 34);
    }
  }

  ctx.putImageData(frame, 0, 0);
  const feathered = Texture.from(canvas);
  feathered.source.scaleMode = "linear";
  return feathered;
}

/**
 * Adoucit uniquement les bords verticaux d'une tuile. Deux tuiles qui se
 * recouvrent peuvent alors partager une vraie couture, sans tranche de pixels.
 */
function featherHorizontalEdges(texture: Texture, feather: number): Texture {
  const resource = texture.source.resource as CanvasImageSource | undefined;
  if (!resource) return texture;

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(texture.frame.width);
  canvas.height = Math.round(texture.frame.height);

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return texture;

  ctx.drawImage(
    resource,
    texture.frame.x,
    texture.frame.y,
    texture.frame.width,
    texture.frame.height,
    0,
    0,
    canvas.width,
    canvas.height,
  );
  const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const pixels = frame.data;
  const edgeWidth = Math.max(1, Math.min(feather, canvas.width / 2));

  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const edge = Math.min(1, (x + 1) / edgeWidth, (canvas.width - x) / edgeWidth);
      if (edge >= 1) continue;
      const smooth = edge * edge * (3 - 2 * edge);
      const alpha = (y * canvas.width + x) * 4 + 3;
      pixels[alpha] = Math.round(pixels[alpha] * smooth);
    }
  }

  ctx.putImageData(frame, 0, 0);
  const feathered = Texture.from(canvas);
  feathered.source.scaleMode = "linear";
  return feathered;
}

/**
 * Découpe uniquement l'entrée d'une tuile avec une lisière irrégulière. La tuile
 * précédente reste opaque sous le recouvrement : on masque une couture sans créer
 * de fondu bilatéral ni de bande verticale translucide.
 */
function featherOrganicLeftEdge(texture: Texture, feather: number): Texture {
  const resource = texture.source.resource as CanvasImageSource | undefined;
  if (!resource) return texture;

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(texture.frame.width);
  canvas.height = Math.round(texture.frame.height);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return texture;

  ctx.drawImage(
    resource,
    texture.frame.x,
    texture.frame.y,
    texture.frame.width,
    texture.frame.height,
    0,
    0,
    canvas.width,
    canvas.height,
  );
  const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const pixels = frame.data;
  const edgeWidth = Math.max(4, Math.min(feather, canvas.width / 3));

  for (let y = 0; y < canvas.height; y++) {
    const irregularity =
      0.5 +
      Math.sin(y * 0.061) * 0.18 +
      Math.sin(y * 0.173 + 1.7) * 0.11 +
      Math.sin(y * 0.419 + 0.4) * 0.055;
    const boundary = edgeWidth * Math.max(0.15, Math.min(0.85, irregularity));
    for (let x = 0; x < edgeWidth; x++) {
      const coverage = Math.max(0, Math.min(1, (x - boundary + 2) / 4));
      if (coverage >= 1) continue;
      const alpha = (y * canvas.width + x) * 4 + 3;
      pixels[alpha] = Math.round(pixels[alpha] * coverage);
    }
  }

  ctx.putImageData(frame, 0, 0);
  const feathered = Texture.from(canvas);
  feathered.source.scaleMode = "linear";
  return feathered;
}

/**
 * Refuse une tuile couvrante dont les deux raccords latéraux ne commencent pas
 * sur la même ligne. La mesure se fait après détourage mais avant le fondu des
 * bords : le fondu ne peut donc pas masquer une géométrie de couture invalide.
 */
function hasAlignedSideSockets(texture: Texture, tolerance: number): boolean {
  const resource = texture.source.resource as CanvasImageSource | undefined;
  if (!resource) return false;

  const width = Math.round(texture.frame.width);
  const height = Math.round(texture.frame.height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return false;

  ctx.drawImage(
    resource,
    texture.frame.x,
    texture.frame.y,
    texture.frame.width,
    texture.frame.height,
    0,
    0,
    width,
    height,
  );
  const pixels = ctx.getImageData(0, 0, width, height).data;
  const firstOpaqueY = (x: number) => {
    for (let y = 0; y < height; y += 1) {
      if (pixels[(y * width + x) * 4 + 3] >= 128) return y;
    }
    return -1;
  };

  const left = firstOpaqueY(0);
  const right = firstOpaqueY(width - 1);
  const bottomLeft = pixels[((height - 1) * width) * 4 + 3];
  const bottomCenter =
    pixels[((height - 1) * width + Math.floor(width / 2)) * 4 + 3];
  const bottomRight = pixels[((height - 1) * width + width - 1) * 4 + 3];

  return (
    left >= 0 &&
    right >= 0 &&
    Math.abs(left - right) <= tolerance &&
    bottomLeft >= 128 &&
    bottomCenter >= 128 &&
    bottomRight >= 128
  );
}

/** Préfloute une texture une seule fois au chargement, sans filtre GPU par frame. */
function blurTexture(texture: Texture, radius: number): Texture {
  const resource = texture.source.resource as CanvasImageSource | undefined;
  if (!resource) return texture;

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(texture.frame.width);
  canvas.height = Math.round(texture.frame.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) return texture;

  ctx.filter = `blur(${radius}px)`;
  ctx.drawImage(
    resource,
    texture.frame.x,
    texture.frame.y,
    texture.frame.width,
    texture.frame.height,
    0,
    0,
    canvas.width,
    canvas.height,
  );
  ctx.filter = "none";

  const blurred = Texture.from(canvas);
  blurred.source.scaleMode = "linear";
  return blurred;
}

function loadImage(
  url: string,
  chromaKey: boolean,
  preserveTopLeft = false,
  horizontalFeather = 0,
  blurRadius = 0,
  sideSocketTolerance = 0,
  edgeStyle: "smooth" | "organic-left" = "smooth",
): Promise<Texture | null> {
  const key = `${url}:${chromaKey ? "key" : "alpha"}:${preserveTopLeft ? "keep-tl" : "all"}:feather-${horizontalFeather}-${edgeStyle}:blur-${blurRadius}:socket-${sideSocketTolerance}`;
  const pending = PENDING.get(key);
  if (pending) return pending;

  const promise = new Promise<Texture | null>((resolve) => {
    const image = new Image();
    image.onload = () => {
      try {
        let texture = chromaKey
          ? keyOut(image, preserveTopLeft)
          : Texture.from(image);
        if (
          sideSocketTolerance > 0 &&
          !hasAlignedSideSockets(texture, sideSocketTolerance)
        ) {
          console.error(
            `[world] Tuile rejetée : raccords latéraux non alignés (${url})`,
          );
          PENDING.delete(key);
          resolve(null);
          return;
        }
        if (horizontalFeather > 0) {
          texture =
            edgeStyle === "organic-left"
              ? featherOrganicLeftEdge(texture, horizontalFeather)
              : featherHorizontalEdges(texture, horizontalFeather);
        }
        if (blurRadius > 0) texture = blurTexture(texture, blurRadius);
        texture.source.scaleMode = "linear";
        PENDING.delete(key);
        resolve(texture);
      } catch {
        PENDING.delete(key);
        resolve(null);
      }
    };
    image.onerror = () => {
      PENDING.delete(key);
      resolve(null);
    };
    image.src = url;
  });

  PENDING.set(key, promise);
  return promise;
}

function atlasTexture(base: Texture, index: number): Texture {
  const column = index % 5;
  const row = Math.floor(index / 5);
  const left = Math.floor((column * base.width) / 5);
  const right = Math.floor(((column + 1) * base.width) / 5);
  const top = Math.floor((row * base.height) / 2);
  const bottom = Math.floor(((row + 1) * base.height) / 2);

  return new Texture({
    source: base.source,
    frame: new Rectangle(left, top, right - left, bottom - top),
    label: `adventurer-${index}`,
  });
}

/**
 * Recale une feuille d'animation autour d'un pivot stable. ImageGen peut garder
 * le même personnage tout en déplaçant son dessin de quelques pixels d'une case
 * à l'autre ; ici, le haut du corps reste centré et le contact au sol reste fixe.
 */
function normalizeActionAtlas(
  base: Texture,
  columns: number,
  rows: number,
): Texture {
  const resource = base.source.resource as CanvasImageSource | undefined;
  if (!resource) return base;

  const width = Math.round(base.frame.width);
  const height = Math.round(base.frame.height);
  const frameWidth = Math.floor(width / columns);
  const frameHeight = Math.floor(height / rows);
  const source = document.createElement("canvas");
  const output = document.createElement("canvas");
  source.width = output.width = width;
  source.height = output.height = height;

  const sourceContext = source.getContext("2d", { willReadFrequently: true });
  const outputContext = output.getContext("2d");
  if (!sourceContext || !outputContext) return base;

  sourceContext.drawImage(resource, 0, 0, width, height);
  const sourceFrame = sourceContext.getImageData(0, 0, width, height);
  const pixels = sourceFrame.data;

  // Les feuilles générées sur fond magenta gardent parfois un liseré violet
  // semi-transparent. Neutraliser uniquement les pixels où rouge ET bleu
  // dominent le vert conserve les vêtements rouges/bleus tout en nettoyant le bord.
  for (let index = 0; index < pixels.length; index += 4) {
    if (pixels[index + 3] < 4) continue;
    const green = pixels[index + 1];
    const magentaBias = Math.min(pixels[index], pixels[index + 2]) - green;
    if (magentaBias <= 18) continue;
    pixels[index] = Math.min(pixels[index], green + 18);
    pixels[index + 2] = Math.min(pixels[index + 2], green + 22);
  }
  sourceContext.putImageData(sourceFrame, 0, 0);

  for (let frameIndex = 0; frameIndex < columns * rows; frameIndex++) {
    const column = frameIndex % columns;
    const row = Math.floor(frameIndex / columns);
    const left = column * frameWidth;
    const top = row * frameHeight;
    let minX = frameWidth;
    let minY = frameHeight;
    let maxX = 0;
    let maxY = 0;

    for (let y = 0; y < frameHeight; y++) {
      for (let x = 0; x < frameWidth; x++) {
        const alpha = pixels[((top + y) * width + left + x) * 4 + 3];
        if (alpha < 28) continue;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }

    if (minX > maxX || minY > maxY) continue;

    // Le centre pondéré de la moitié haute suit le torse, pas le skateboard,
    // la lettre lancée ou les jambes qui s'écartent pendant le mouvement.
    const bandTop = minY + (maxY - minY) * 0.12;
    const bandBottom = minY + (maxY - minY) * 0.62;
    let weightedX = 0;
    let weight = 0;
    for (let y = Math.floor(bandTop); y <= Math.ceil(bandBottom); y++) {
      for (let x = minX; x <= maxX; x++) {
        const alpha = pixels[((top + y) * width + left + x) * 4 + 3];
        if (alpha < 28) continue;
        weightedX += x * alpha;
        weight += alpha;
      }
    }

    const pivotX = weight > 0 ? weightedX / weight : (minX + maxX) * 0.5;
    const offsetX = Math.round(frameWidth * 0.5 - pivotX);
    const offsetY = Math.round(frameHeight - 12 - maxY);

    outputContext.drawImage(
      source,
      left,
      top,
      frameWidth,
      frameHeight,
      left + offsetX,
      top + offsetY,
      frameWidth,
      frameHeight,
    );
  }

  const texture = Texture.from(output);
  texture.source.scaleMode = "linear";
  return texture;
}

async function loadCharacter(characterId: string): Promise<Texture | null> {
  if (CACHE.has(characterId)) return CACHE.get(characterId) ?? null;

  // Ces classes viennent d'un atlas d'animation plein-corps. Ne pas charger en
  // plus leur ancienne illustration statique : un seul pipeline, un seul asset.
  if (ACTION_SHEETS[characterId]) {
    CACHE.set(characterId, null);
    return null;
  }

  const atlasIndex = ATLAS_INDEX[characterId];
  const texture =
    atlasIndex === undefined
      ? null
      : await loadImage(ATLAS_URL, true).then((atlas) =>
          atlas ? atlasTexture(atlas, atlasIndex) : null,
        );

  CACHE.set(characterId, texture);
  return texture;
}

/** Renvoie la texture peinte, ou null pour les classes encore dessinées en code. */
export function useCharacterSprite(characterId: string): Texture | null {
  const [texture, setTexture] = useState<Texture | null>(
    () => CACHE.get(characterId) ?? null,
  );

  useEffect(() => {
    let alive = true;
    loadCharacter(characterId).then((result) => {
      if (alive) setTexture(result);
    });
    return () => {
      alive = false;
    };
  }, [characterId]);

  return texture;
}

const ASSET_CACHE = new Map<string, Texture | null>();

/** Charge un accessoire peint unique avec le même pipeline que les personnages. */
export function usePaintedAsset(
  url: string,
  chromaKey = false,
  preserveTopLeft = false,
  enabled = true,
  horizontalFeather = 0,
  blurRadius = 0,
  sideSocketTolerance = 0,
  cacheResult = true,
  edgeStyle: "smooth" | "organic-left" = "smooth",
): Texture | null {
  const cacheKey = `${url}:${chromaKey ? "key" : "alpha"}:${preserveTopLeft ? "keep-tl" : "all"}:feather-${horizontalFeather}-${edgeStyle}:blur-${blurRadius}:socket-${sideSocketTolerance}`;
  const [texture, setTexture] = useState<Texture | null>(
    () => (cacheResult ? (ASSET_CACHE.get(cacheKey) ?? null) : null),
  );

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    let transientTexture: Texture | null = null;
    loadImage(
      url,
      chromaKey,
      preserveTopLeft,
      horizontalFeather,
      blurRadius,
      sideSocketTolerance,
      edgeStyle,
    ).then((result) => {
      if (cacheResult) ASSET_CACHE.set(cacheKey, result);
      else if (!alive) {
        if (result) result.destroy(true);
        return;
      } else transientTexture = result;
      if (alive) setTexture(result);
    });
    return () => {
      alive = false;
      if (transientTexture) transientTexture.destroy(true);
    };
  }, [
    blurRadius,
    cacheResult,
    cacheKey,
    chromaKey,
    enabled,
    edgeStyle,
    horizontalFeather,
    preserveTopLeft,
    sideSocketTolerance,
    url,
  ]);

  return enabled ? texture : null;
}

/** Texture de terrain avec une couture horizontale étroite et réutilisable. */
export function useFeatheredPaintedAsset(
  url: string,
  enabled = true,
  horizontalFeather = 96,
): Texture | null {
  return usePaintedAsset(
    url,
    false,
    false,
    enabled,
    horizontalFeather,
  );
}

const GRID_CACHE = new WeakMap<Texture, Map<string, Texture[]>>();

/** Découpe une texture en cellules régulières, puis partage les mêmes sous-textures. */
export function atlasFrames(base: Texture, columns: number, rows: number): Texture[] {
  const key = `${columns}x${rows}`;
  const byGrid = GRID_CACHE.get(base) ?? new Map<string, Texture[]>();
  const cached = byGrid.get(key);
  if (cached) return cached;

  const frames = Array.from({ length: columns * rows }, (_, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const left = Math.floor((column * base.frame.width) / columns);
    const right = Math.floor(((column + 1) * base.frame.width) / columns);
    const top = Math.floor((row * base.frame.height) / rows);
    const bottom = Math.floor(((row + 1) * base.frame.height) / rows);

    return new Texture({
      source: base.source,
      frame: new Rectangle(
        base.frame.x + left,
        base.frame.y + top,
        right - left,
        bottom - top,
      ),
      label: `${base.label ?? "painted-atlas"}-${key}-${index}`,
    });
  });

  byGrid.set(key, frames);
  GRID_CACHE.set(base, byGrid);
  return frames;
}

/** Charge et découpe un atlas peint sans multiplier les textures GPU. */
export function usePaintedAtlas(
  url: string,
  columns: number,
  rows: number,
  chromaKey = false,
  preserveTopLeft = false,
): Texture[] | null {
  const base = usePaintedAsset(url, chromaKey, preserveTopLeft);
  return useMemo(
    () => (base ? atlasFrames(base, columns, rows) : null),
    [base, columns, rows],
  );
}

const ACTION_CACHE = new Map<string, Texture[] | null>();
const JUMP_CACHE = new Map<string, Texture[] | null>();

function useCharacterFrames(
  characterId: string,
  sheets: Partial<Record<string, ActionSheet>>,
  cache: Map<string, Texture[] | null>,
): Texture[] | null {
  const [frames, setFrames] = useState<Texture[] | null>(
    () => cache.get(characterId) ?? null,
  );

  useEffect(() => {
    let alive = true;
    const sheet = sheets[characterId];
    if (!sheet) {
      queueMicrotask(() => {
        if (alive) setFrames(null);
      });
      return () => {
        alive = false;
      };
    }

    const cached = cache.get(characterId);
    if (cached) {
      queueMicrotask(() => {
        if (alive) setFrames(cached);
      });
      return () => {
        alive = false;
      };
    }

    loadImage(sheet.url, false).then((atlas) => {
      const offset = sheet.offset ?? 0;
      const normalized = atlas
        ? normalizeActionAtlas(atlas, sheet.columns, sheet.rows)
        : null;
      const result = normalized
        ? atlasFrames(normalized, sheet.columns, sheet.rows).slice(
            offset,
            offset + (sheet.frameCount ?? 8),
          )
        : null;
      cache.set(characterId, result);
      if (alive) setFrames(result);
    });

    return () => {
      alive = false;
    };
  }, [cache, characterId, sheets]);

  return frames;
}

/**
 * Huit poses complètes : 0–1 idle, 2–3 déplacement, 4 candidature,
 * 5 refus, 6 rejet légendaire, 7 victoire.
 */
export function useCharacterActionFrames(characterId: string): Texture[] | null {
  return useCharacterFrames(characterId, ACTION_SHEETS, ACTION_CACHE);
}

/** Douze poses dédiées à un seul bond, indépendantes des réactions d'action. */
export function useCharacterJumpFrames(characterId: string): Texture[] | null {
  return useCharacterFrames(characterId, JUMP_SHEETS, JUMP_CACHE);
}
