/**
 * Qui joue sur cette machine.
 *
 * Volontairement séparé de l'état de la partie : la partie est commune au groupe
 * et finira dans Neon, alors que cette information est propre à l'ordinateur et
 * doit rester locale. C'est elle qui évite de repasser par l'écran de sélection
 * à chaque visite.
 */

const SESSION_KEY = "louchomage:moi:v1";

export function loadSession(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

export function saveSession(playerId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SESSION_KEY, playerId);
  } catch {
    // Mode privé : on jouera sans être reconnu au prochain lancement.
  }
}

export function clearSession(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(SESSION_KEY);
  } catch {
    // Rien à faire : l'appelant a déjà oublié le joueur côté React.
  }
}
