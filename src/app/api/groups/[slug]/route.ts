import { getDb } from "@/lib/server/db";
import { loadSnapshot, playerForToken } from "@/lib/server/groups";
import { deviceToken, errorResponse, requireGroup } from "@/lib/server/http";

/** The group's game, or just its version when nothing changed since the one given. */
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const group = await requireGroup(slug);
    const db = getDb();
    const known = Number(new URL(request.url).searchParams.get("version") ?? NaN);
    const me = await playerForToken(db, group.id, deviceToken(request));
    // Most polls find nothing new: answer from the version alone, without the state.
    if (Number.isFinite(known) && known > 0 && (await db.loadVersion(group.id)) === known) return Response.json({ unchanged: true, version: known, me });
    const snapshot = await loadSnapshot(db, group.id);
    return Response.json({ name: group.name, slug: group.slug, state: snapshot.state, version: snapshot.version, me });
  } catch (error) {
    return errorResponse(error);
  }
}
