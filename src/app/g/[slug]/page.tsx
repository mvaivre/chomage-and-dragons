import { notFound, redirect } from "next/navigation";
import { GameLoader } from "@/components/GameLoader";
import { getDb } from "@/lib/server/db";
import { hasSession } from "@/lib/server/http";

/** The group's game, for browsers that entered its password. */
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const group = await getDb().findGroupBySlug(slug);
  if (!group) notFound();
  if (!(await hasSession(group))) redirect(`/g/${encodeURIComponent(slug)}/rejoindre`);
  return <GameLoader slug={slug} />;
}
