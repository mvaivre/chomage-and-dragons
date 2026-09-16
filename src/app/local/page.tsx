import { GameLoader } from "@/components/GameLoader";

/** Solo mode: the game stays in this browser. Handy offline, and for the browser tests. */
export default function Page() {
  return <GameLoader />;
}
