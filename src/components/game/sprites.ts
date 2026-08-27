"use client";

import { useEffect, useState } from "react";
import { Texture } from "pixi.js";

/**
 * Chargement des sprites de personnages, avec détourage.
 *
 * Les générateurs d'images ne produisent pas de PNG à fond transparent de façon
 * fiable : on demande donc un fond magenta pur et on le retire ici. Les pixels
 * proches du magenta deviennent transparents, et la frange restante est adoucie
 * pour éviter le liseré rose autour de la silhouette.
 *
 * Un sprite absent n'est pas une erreur : le personnage dessiné en code reste
 * affiché. Déposer `public/sprites/<id>.png` suffit à le remplacer.
 */

const CACHE = new Map<string, Texture | null>();
const PENDING = new Map<string, Promise<Texture | null>>();

/** Distance maximale au magenta pur pour considérer un pixel comme du fond. */
const KEY_TOLERANCE = 78;

function keyOut(image: HTMLImageElement): Texture {
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return Texture.from(image);

  ctx.drawImage(image, 0, 0);
  const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const px = frame.data;

  for (let i = 0; i < px.length; i += 4) {
    const distance = Math.hypot(255 - px[i], px[i + 1], 255 - px[i + 2]);
    if (distance < KEY_TOLERANCE) {
      px[i + 3] = 0;
    } else if (distance < KEY_TOLERANCE * 2) {
      // Frange : on retire la dominante magenta plutôt que le pixel entier.
      px[i + 3] = Math.round(255 * ((distance - KEY_TOLERANCE) / KEY_TOLERANCE));
      px[i] = Math.min(px[i], px[i + 1] + 40);
      px[i + 2] = Math.min(px[i + 2], px[i + 1] + 40);
    }
  }

  ctx.putImageData(frame, 0, 0);

  const texture = Texture.from(canvas);
  // Pixel-art : pas d'interpolation, sinon la grille devient floue en zoomant.
  texture.source.scaleMode = "nearest";
  return texture;
}

function load(url: string): Promise<Texture | null> {
  if (CACHE.has(url)) return Promise.resolve(CACHE.get(url) ?? null);

  const pending = PENDING.get(url);
  if (pending) return pending;

  const promise = new Promise<Texture | null>((resolve) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      try {
        resolve(keyOut(image));
      } catch {
        resolve(null);
      }
    };
    image.onerror = () => resolve(null);
    image.src = url;
  }).then((texture) => {
    CACHE.set(url, texture);
    PENDING.delete(url);
    return texture;
  });

  PENDING.set(url, promise);
  return promise;
}

/** Renvoie la texture du personnage, ou null tant qu'elle n'est pas disponible. */
export function useCharacterSprite(characterId: string): Texture | null {
  const url = `/sprites/${characterId}.png`;
  const [texture, setTexture] = useState<Texture | null>(
    () => CACHE.get(url) ?? null,
  );

  useEffect(() => {
    let alive = true;
    // Toujours résolu de façon asynchrone, même déjà en cache : la texture n'est
    // donc jamais posée pendant l'effet lui-même.
    load(url).then((result) => {
      if (alive) setTexture(result);
    });
    return () => {
      alive = false;
    };
  }, [url]);

  return texture;
}
