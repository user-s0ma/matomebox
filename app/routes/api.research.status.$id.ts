import type { Route } from "./+types/api.research.status.$id";
import { getDrizzleClient } from "@/lib/db";
import { researches } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id");

  if (!id) {
    return new Response(JSON.stringify({ error: "IDが必要です" }), {
      status: 400,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  const db = getDrizzleClient();

  try {
    const research = await db.query.researches.findFirst({
      where: eq(researches.id, id),
    });

    if (!research) {
      return new Response(JSON.stringify({ error: "リサーチが見つかりません" }), {
        status: 404,
        headers: {
          "Content-Type": "application/json",
        },
      });
    }

    return new Response(
      JSON.stringify({
        id: research.id,
        status: research.status,
        result: research.result,
        interim_results: research.interim_results ? JSON.parse(research.interim_results) : null,
        created_at: research.created_at,
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.log(error);
    return new Response(JSON.stringify({ error: "データ取得中にエラーが発生しました" }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }
}
