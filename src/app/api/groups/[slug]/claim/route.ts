import { getDb } from "@/lib/server/db";
import { claimPlayer } from "@/lib/server/groups";
import { errorResponse, readJson, requireGroup } from "@/lib/server/http";

/** Take a character over on this device with its PIN; other devices lose it. */
export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const group = await requireGroup(slug);
    const body = await readJson(request);
    const token = await claimPlayer(getDb(), group, body.playerId, body.pin);
    return Response.json({ deviceToken: token });
  } catch (error) {
    return errorResponse(error);
  }
}
