import { mulberry32, pick, shuffle } from "@/lib/game/random";

/**
 * The recruiter's personality test. Every question has one answer a hiring
 * manager wants to hear; the rest is what an honest person would say.
 */
export const QUIZ = {
  questions: 5,
  secondsPerQuestion: 7,
  /** Correct answers needed out of QUIZ.questions. */
  needed: 4,
} as const;

export interface QuizQuestion {
  prompt: string;
  /** The first answer is the corporate one; answers are shuffled per attempt. */
  answers: readonly [string, string, string, string];
  /** What the recruiter mutters after the answer. */
  aside: string;
}

export const QUIZ_BANK: readonly QuizQuestion[] = [
  { prompt: "Quel est votre plus grand défaut ?", answers: ["Je suis trop perfectionniste", "Je mords", "Le lundi", "Aucun, j’ai vérifié"], aside: "Classique, mais ça passe." },
  { prompt: "Où vous voyez-vous dans cinq ans ?", answers: ["En train de faire grandir l’équipe", "Dans la même file à l’ORP", "Sur une île sans wifi", "Cinq ans, c’est long"], aside: "Ambition validée." },
  { prompt: "Pourquoi voulez-vous travailler chez nous ?", answers: ["Vos valeurs résonnent avec les miennes", "Vous avez répondu", "Le parking", "Le chômage m’a dit de venir"], aside: "Nos valeurs, oui, celles du site web." },
  { prompt: "Êtes-vous à l’aise avec la pression ?", answers: ["J’y puise mon énergie", "Uniquement la bière pression", "Je pleure discrètement", "Demandez à mon plombier"], aside: "Parfait, on en a beaucoup." },
  { prompt: "Comment gérez-vous les conflits ?", answers: ["Avec écoute active et transparence", "Par duel à l’aube", "Je change de canton", "Je les gagne"], aside: "Écoute active, noté." },
  { prompt: "Un mot pour vous décrire ?", answers: ["Force de proposition", "Disponible", "Fatigué·e", "Chômeur·euse pro"], aside: "Ça fait trois mots, mais j’aime." },
  { prompt: "Plutôt leader ou suiveur ?", answers: ["Leader bienveillant, suiveur agile", "Ça dépend de qui paie", "Plutôt assis·e", "Loup solitaire"], aside: "Les deux à la fois, impressionnant." },
  { prompt: "Vos prétentions salariales ?", answers: ["Selon la grille et l’évolution", "Un salaire", "Le vôtre, moins un franc", "En CHF, de préférence"], aside: "La grille, on l’a perdue." },
  { prompt: "Il y a un trou dans votre CV…", answers: ["Une période de développement personnel", "C’est le format A4", "Un dragon l’a mangé", "J’ai dormi"], aside: "Développement personnel, très bien." },
  { prompt: "Comment travaillez-vous en équipe ?", answers: ["En mode collaboratif et synergique", "Le moins possible", "Avec un fouet", "Par courrier"], aside: "Synergique. Mon mot préféré." },
  { prompt: "Votre plus grande réussite ?", answers: ["Avoir fédéré une équipe autour d’une vision", "Cet entretien, si ça passe", "47 candidatures ce mois-ci", "Le niveau 12 de Candy Crush"], aside: "Fédérer. Vision. Bingo." },
  { prompt: "Que pensez-vous des heures supplémentaires ?", answers: ["Un investissement dans le projet", "Payées ?", "Non", "Ha ha ha"], aside: "Investissement non payé, donc." },
  { prompt: "Et si votre manager avait tort ?", answers: ["Je l’accompagnerais avec bienveillance", "Rien, il a tort", "Je prendrais des notes pour plus tard", "Je le dirais à sa mère"], aside: "Accompagner. Bienveillance. Je note." },
  { prompt: "Quel animal seriez-vous ?", answers: ["Un loup, pour l’esprit de meute", "Un pigeon à reculons", "Un paresseux", "Un crapaud corporate"], aside: "Encore un loup. Ils sont tous loups." },
  { prompt: "Comment restez-vous à jour ?", answers: ["Veille active et formation continue", "LinkedIn me spamme", "Je demande à un stagiaire", "Je ne suis pas à jour"], aside: "Veille active, voilà." },
  { prompt: "Pourquoi avoir quitté votre dernier poste ?", answers: ["Pour relever de nouveaux défis", "On me l’a demandé, fort", "Le café", "La sécurité m’a raccompagné·e"], aside: "De nouveaux défis. Comme tout le monde." },
  { prompt: "Vous parlez suisse allemand ?", answers: ["Je progresse chaque jour", "Grüezi, et puis je fuis", "Non, et vous ?", "Seulement après deux verres"], aside: "Progresser, c’est déjà ça." },
  { prompt: "Un test de trois jours non payé, ça vous va ?", answers: ["Avec enthousiasme", "Trois jours de quoi ?", "Je facture", "Mon avocat dit non"], aside: "Quel enthousiasme." },
  { prompt: "Comment réagissez-vous à la critique ?", answers: ["Comme une opportunité d’apprentissage", "Je note le nom", "Mal", "Je critique en retour"], aside: "Opportunité. Apprentissage. Oui." },
  { prompt: "Décrivez votre journée idéale au travail.", answers: ["Des objectifs clairs et de l’impact", "Courte", "Télétravail depuis la plage", "Sans réunion, donc impossible"], aside: "De l’impact, j’adore." },
  { prompt: "Des questions pour nous ?", answers: ["Quelles sont les perspectives d’évolution ?", "C’est fini ?", "Vous m’auriez pris·e sans le test ?", "Le parking est gratuit ?"], aside: "Perspectives. Évolution. Parfait." },
  { prompt: "Pourquoi vous plutôt qu’un·e autre ?", answers: ["Mon profil correspond à vos besoins", "J’ai déjà le badge", "L’autre a fui", "Question piège ?"], aside: "Correspond aux besoins, dit le profil." },
  { prompt: "Disponible quand ?", answers: ["Immédiatement et durablement", "Après les vacances", "Le mardi", "Quand le chômage arrête de payer"], aside: "Durablement, on verra." },
  { prompt: "Un dernier mot ?", answers: ["Merci pour cet échange inspirant", "Croâ", "Vous me rappelez ?", "J’ai vu le salaire, je retire"], aside: "Inspirant. Nous aussi." },
] as const;

export interface DealtQuestion {
  prompt: string;
  answers: string[];
  /** Index of the corporate answer after shuffling. */
  correct: number;
  aside: string;
}

export function dealQuiz(seed: number, count = QUIZ.questions): DealtQuestion[] {
  const random = mulberry32(seed);
  return pick(QUIZ_BANK, count, random).map(question => {
    const order = shuffle([0, 1, 2, 3], random);
    return { prompt: question.prompt, answers: order.map(i => question.answers[i]), correct: order.indexOf(0), aside: question.aside };
  });
}

/** The corporate answer of a question, looked up by its prompt (used by the browser tests). */
export function corporateAnswer(prompt: string): string | undefined {
  return QUIZ_BANK.find(question => question.prompt === prompt)?.answers[0];
}

export function quizPassed(correct: number): boolean {
  return correct >= QUIZ.needed;
}
