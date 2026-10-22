import type { Metadata } from "next";
import { GameLoader } from "@/components/GameLoader";

export const metadata: Metadata = {
  title: "Le monde voxel — Chômage & Dragons",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <GameLoader />;
}
