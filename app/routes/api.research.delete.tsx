import type { Route } from "./+types/api.research.delete";
import { getDrizzleClient } from "@/lib/db";
import { researches } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function action({ request }: Route.LoaderArgs) {
  const { id } = (await request.json()) as any;

  if (!id) {
    return new Response(JSON.stringify({ error: "リサーチIDが提供されていません" }), {
      status: 400,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  const db = getDrizzleClient();

  await db.delete(researches).where(eq(researches.id, id));

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
    },
  });
}
