/**
 * Le jeu d'icônes de l'interface.
 *
 * Dessinées à la main plutôt que prises dans une bibliothèque : il en faut huit, et
 * un trait un peu épais, un peu irrégulier, tient l'ambiance mieux qu'un pictogramme
 * d'application. Elles héritent de la couleur du texte.
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

/** Candidature : le pigeon voyageur, parchemin à la patte. */
export function PigeonIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M3 13c2.5-4 6-5.5 9-4.5" />
      <path d="M12 8.5c1.4-2 3.6-2.6 5.5-1.6L21 4l-1 4.4c.6 2.6-.7 5.3-3.2 6.6-2.9 1.5-6.4.8-8.5-1.4" />
      <path d="M8.3 13.6 6 20" />
      <path d="M11.5 14.6 11 20" />
      <circle cx="17.4" cy="7.9" r=".7" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Refus : l'éclair. */
export function BoltIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M13.5 2 5 13.5h5L9 22l9-12h-5.5z" />
    </svg>
  );
}

/** Entretien : la coupe levée. */
export function GobletIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M6 3h12l-1.4 6.2A5 5 0 0 1 12 13a5 5 0 0 1-4.6-3.8z" />
      <path d="M12 13v6" />
      <path d="M8 21h8" />
      <path d="M6.6 6.2h10.8" />
    </svg>
  );
}

/** Rejet après entretien : le crâne de la LEGENDARY REJECTION. */
export function SkullIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M12 2.5c4.4 0 7.5 3 7.5 7v3.2c0 1-.6 1.9-1.5 2.3l-.8.4v2.4c0 1.2-1 2.2-2.2 2.2H9c-1.2 0-2.2-1-2.2-2.2v-2.4l-.8-.4A2.6 2.6 0 0 1 4.5 12.7V9.5c0-4 3.1-7 7.5-7z" />
      <circle cx="9.2" cy="10.6" r="1.7" fill="currentColor" stroke="none" />
      <circle cx="14.8" cy="10.6" r="1.7" fill="currentColor" stroke="none" />
      <path d="M12 14.2v2" />
    </svg>
  );
}

/** Embauche : la coupe du champion. */
export function TrophyIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M7 4h10v5a5 5 0 0 1-10 0z" />
      <path d="M7 5.5H4.5v1.8A3.5 3.5 0 0 0 7.6 10.8" />
      <path d="M17 5.5h2.5v1.8a3.5 3.5 0 0 1-3.1 3.5" />
      <path d="M12 14v3.5" />
      <path d="M8.5 21h7l-.8-3.5H9.3z" />
    </svg>
  );
}

/** Annuler : le clic de trop. */
export function UndoIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M4 9h9.5a5.5 5.5 0 1 1 0 11H8" />
      <path d="M8 4.5 3.5 9 8 13.5" />
    </svg>
  );
}

/** La couronne des classements. */
export function CrownIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M3 8.5l3.2 3L12 4.5l5.8 7 3.2-3-1.6 10.5H4.6z" />
      <path d="M4.6 19h14.8" />
    </svg>
  );
}

/** Le coffre des paliers de dix candidatures. */
export function ChestIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M3.5 9.5C3.5 6.5 7.3 4.5 12 4.5s8.5 2 8.5 5v9.5h-17z" />
      <path d="M3.5 11.5h17" />
      <path d="M10 11.5h4v3h-4z" />
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
