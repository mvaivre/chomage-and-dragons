/** Explicit emphasis keeps the meaning, spelling and punctuation of each punchline. */
const EMPHASIS =
  /error 404|porté disparu|déclaration d'impôt|main gauche|pommes de terre|mise en page|side quest|trois ans|vieux mégot mouillé|\b7h12\b|[\p{L}·]+/gu;
const WORDS = new Set([
  "chaise",
  "évolution",
  "limites",
  "cerveau",
  "charisme",
  "mauvais·e",
  "potentiel",
  "échec",
  "cailloux",
  "dynamiques",
  "aura",
  "démissionner",
  "énergie",
  "lundi",
  "ombre",
  "plan",
  "brouillon",
  "secondaire",
  "ambition",
  "bataille",
  "réveil",
  "existence",
  "tutoriel",
  "dieux",
  "médiocrité",
  "figurant",
  "confiance",
  "invoqué",
  "erreur",
]);
export function dialogueTokens(text: string) {
  const tokens: { text: string; start: number; emphasis: boolean }[] = [];
  let cursor = 0;
  for (const match of text.matchAll(EMPHASIS)) {
    if (match.index > cursor)
      tokens.push({
        text: text.slice(cursor, match.index),
        start: cursor,
        emphasis: false,
      });
    const word = match[0];
    tokens.push({
      text: word,
      start: match.index,
      emphasis: WORDS.has(word.toLocaleLowerCase("fr")) || /\s|\d/.test(word),
    });
    cursor = match.index + word.length;
  }
  if (cursor < text.length)
    tokens.push({ text: text.slice(cursor), start: cursor, emphasis: false });
  return tokens;
}
export function letterDelay(letter: string) {
  return /[.!?…]/.test(letter) ? 160 : /[,;:]/.test(letter) ? 95 : 32;
}
