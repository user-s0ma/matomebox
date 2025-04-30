import type { Route } from "./+types/api.research.create";
import { getDrizzleClient } from "@/lib/db";
import { researches } from "@/db/schema";
import { and, gt } from "drizzle-orm";

const RATE_LIMIT = {
  MAX_REQUESTS: 5, // 5
  WINDOW_MS: 30 * 60 * 1000, // 30m
};

export async function action({ request, context }: Route.LoaderArgs) {
  const { query, depth, breadth } = (await request.json()) as any;

  const db = getDrizzleClient();

  const thirtyMinutesAgo = new Date(Date.now() - RATE_LIMIT.WINDOW_MS);

  const recentResearches = await db
    .select()
    .from(researches)
    .where(and(gt(researches.created_at, thirtyMinutesAgo)));

  const count = recentResearches.length;

  if (count >= RATE_LIMIT.MAX_REQUESTS) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "Rate limit exceeded. Please try again later.",
      }),
      { status: 429, headers: { "Content-Type": "application/json" } }
    );
  }

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
    headers: { "Content-Type": "application/json" },
  });
}
