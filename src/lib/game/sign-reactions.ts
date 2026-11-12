export function signReaction(text: string): "confetti" | "letters" | "dust" | "stars" {
  if (/confettis/i.test(text)) return "confetti";
  if (/ci-gît|repose|oublié/i.test(text)) return "dust";
  if (/CV|refus|candidature|dossier|formulaire|lettre/i.test(text)) return "letters";
  return "stars";
}
