/**
 * Qui joue sur cette machine, pour une partie donnée.
 *
 * Volontairement séparé de l'état de la partie : la partie est commune au groupe
 * et vit sur le serveur, alors que cette information est propre à l'appareil et
 * doit rester locale. C'est elle qui évite de repasser par l'écran de sélection
 * à chaque visite. Le mode solo garde sa clé historique.
 */

const LEGACY_KEY = "louchomage:moi:v1";

function key(scope: string): string {
  return scope === "local" ? LEGACY_KEY : `louchomage:moi:${scope}`;
}

export function loadSession(scope = "local"): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key(scope));
  } catch {
    return null;
  }
}

export function saveSession(playerId: string, scope = "local"): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key(scope), playerId);
  } catch {
    // Mode privé : on jouera sans être reconnu au prochain lancement.
  }
}

export function clearSession(scope = "local"): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key(scope));
  } catch {
    // Rien à faire : l'appelant a déjà oublié le joueur côté React.
  }
}

/** The groups this device has entered, to find them again from the landing page. */
export interface KnownGroup {
  slug: string;
  name: string;
}

const GROUPS_KEY = "louchomage:groupes:v1";

export function loadKnownGroups(): KnownGroup[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(GROUPS_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((g) => g && typeof g.slug === "string" && typeof g.name === "string") : [];
  } catch {
    return [];
  }
}

export function rememberGroup(group: KnownGroup): void {
  if (typeof window === "undefined") return;
  try {
    const others = loadKnownGroups().filter((g) => g.slug !== group.slug);
    window.localStorage.setItem(GROUPS_KEY, JSON.stringify([group, ...others].slice(0, 12)));
  } catch {
    // Sans mémoire locale, on retrouvera le groupe par son lien.
  }
}

export function forgetGroup(slug: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(GROUPS_KEY, JSON.stringify(loadKnownGroups().filter((g) => g.slug !== slug)));
  } catch {
    // Rien à faire.
  }
}
