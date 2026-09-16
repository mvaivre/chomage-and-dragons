import { getDb } from "@/lib/server/db";
import { loadSnapshot, playerForToken } from "@/lib/server/groups";
import { deviceToken, errorResponse, requireGroup } from "@/lib/server/http";

/** The group's game, or just its version when nothing changed since the one given. */
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const group = await requireGroup(slug);
    const snapshot = await loadSnapshot(getDb(), group.id);
    const known = Number(new URL(request.url).searchParams.get("version"));
    const me = await playerForToken(getDb(), group.id, deviceToken(request));
    if (Number.isFinite(known) && known === snapshot.version) return Response.json({ unchanged: true, version: snapshot.version, me });
    return Response.json({ name: group.name, slug: group.slug, state: snapshot.state, version: snapshot.version, me });
  } catch (error) {
    return errorResponse(error);
  }
}
