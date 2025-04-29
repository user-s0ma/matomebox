import type { Route } from "./+types/api.research.create";
import { getDrizzleClient } from "@/lib/db";
import { researches } from "@/db/schema";

export async function action({ request, context }: Route.LoaderArgs) {
  const { query, depth, breadth } = (await request.json()) as any;

  const db = getDrizzleClient();

  const [research] = await db
    .insert(researches)
    .values({
      query,
      depth,
      breadth,
      status: 0,
    })
    .$returningId();

  try {
    const id = crypto.randomUUID();

    await context.cloudflare.env.RESEARCH_WORKFLOW.create({
      id,
      params: {
        id: research.id,
        query,
        depth,
        breadth,
      },
    });
  } catch (error) {
    console.error("Failed to start research workflow:", error);
  }
  return new Response(JSON.stringify({ success: true, id: research.id }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
    },
  });
}
