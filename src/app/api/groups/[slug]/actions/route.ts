import { getDb } from "@/lib/server/db";
import { applyGroupAction, playerForToken, validateAction, validateContext } from "@/lib/server/groups";
import { deviceToken, errorResponse, readJson, requireGroup } from "@/lib/server/http";

/** One action of the game, applied by the same reducer the device already ran. */
export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const group = await requireGroup(slug);
    const body = await readJson(request);
    const db = getDb();
    const action = validateAction(body.action);
    const context = validateContext(body.context);
    const tokenPlayer = await playerForToken(db, group.id, deviceToken(request));
    const applied = await applyGroupAction(db, group, action, context, tokenPlayer, body.pin);
    return Response.json(applied);
  } catch (error) {
    return errorResponse(error);
  }
}
