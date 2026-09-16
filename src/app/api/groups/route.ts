import { getDb } from "@/lib/server/db";
import { createGroup } from "@/lib/server/groups";
import { errorResponse, grantSession, readJson } from "@/lib/server/http";

/** Create a group: a name, a password, and this browser is in. */
export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    const group = await createGroup(getDb(), { name: body.name, password: body.password });
    await grantSession(group);
    return Response.json({ slug: group.slug, name: group.name }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
