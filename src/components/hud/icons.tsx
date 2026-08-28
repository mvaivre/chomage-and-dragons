/**
 * Le jeu d'icônes de l'interface.
 *
 * Les illustrations importantes sont désormais bitmap. Ces deux tracés ne servent
 * plus qu’aux commandes utilitaires secondaires.
 */

interface IconProps {
  className?: string;
}

const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

/** Annuler : le clic de trop. */
export function UndoIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M4 9h9.5a5.5 5.5 0 1 1 0 11H8" />
      <path d="M8 4.5 3.5 9 8 13.5" />
    </svg>
  );
}

/** Le parchemin du classement déplié. */
export function ScrollIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M6 3h12v16a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2z" />
      <path d="M9 7h6M9 11h6M9 15h4" />
    </svg>
  );
}
