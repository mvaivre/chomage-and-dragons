import { residentPunchline } from "@/lib/game/punchlines";
/** Every inhabitant, including tavern guests and dragons, uses the punchline bank. */
export function conversationLine(
  id: string,
  kind: string,
  text: string,
  visit: number,
) {
  return kind === "sign" ? text : residentPunchline(id, visit);
}
export const INSPECTION_SECONDS = 5.5;
