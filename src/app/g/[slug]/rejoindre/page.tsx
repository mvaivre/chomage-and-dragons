import { notFound, redirect } from "next/navigation";
import { JoinGroup } from "@/components/hud/JoinGroup";
import { getDb } from "@/lib/server/db";
import { hasSession } from "@/lib/server/http";

/** The invitation link lands here: the group's name, one password field. */
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const group = await getDb().findGroupBySlug(slug);
  if (!group) notFound();
  if (await hasSession(group)) redirect(`/g/${encodeURIComponent(slug)}`);
  return <JoinGroup slug={group.slug} name={group.name} />;
}
