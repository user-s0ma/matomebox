import type { Route } from "./+types/research.status.$id";
import { getDrizzleClient } from "@/lib/db";
import { researches, researchImages, researchSources, researchProgress } from "@/db/schema";
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

    const images = await db.query.researchImages.findMany({
      where: eq(researchImages.research_id, id),
    });

    const sources = await db.query.researchSources.findMany({
      where: eq(researchSources.research_id, id),
    });

    const progress = await db.query.researchProgress.findFirst({
      where: eq(researchProgress.research_id, id),
      orderBy: (progress, { desc }) => [desc(progress.created_at)],
    });

    return new Response(
      JSON.stringify({
        id: research.id,
        status: research.status,
        content: research.content,
        progress: progress ? { message: progress.status_message, percentage: progress.progress_percentage } : null,
        images: images,
        sources: sources,
        created_at: research.created_at,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: "データ取得中にエラーが発生しました" }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }
}
