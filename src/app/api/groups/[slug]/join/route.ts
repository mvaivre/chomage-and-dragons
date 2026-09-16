import { getDb } from "@/lib/server/db";
import { joinGroup } from "@/lib/server/groups";
import { errorResponse, grantSession, readJson } from "@/lib/server/http";

/** The invited friend enters the password; the cookie does the rest. */
export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const body = await readJson(request);
    const group = await joinGroup(getDb(), slug, body.password);
    await grantSession(group);
    return Response.json({ slug: group.slug, name: group.name });
  } catch (error) {
    return errorResponse(error);
  }
}
