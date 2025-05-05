import type { Route } from "./+types/$category";
import { Link, useLoaderData } from "react-router";
import { desc, eq, and } from "drizzle-orm";
import { researches } from "@/db/schema";
import { getDrizzleClient } from "@/lib/db";
import { timeAgo } from "@/lib/utils";

export async function loader({ params }: Route.LoaderArgs) {
  const db = getDrizzleClient();

  const researchResults = await db.query.researches.findMany({
    where: and(eq(researches.status, 2), eq(researches.category, params.category)),
    orderBy: [desc(researches.created_at)],
  });

  return { researches: researchResults };
}

export default function Home() {
  const { researches } = useLoaderData<typeof loader>();

  return (
    <div className="max-w-2xl mx-auto">
      <div className="grid">
        {researches.map((research) => {
          return (
            <Link to={`/article/${research.id}`} key={research.id} className="h-30 flex border-b border-b-stone-500">
              {research.thumbnail ? (
                <img src={research.thumbnail} alt={research.title || ""} className="aspect-square object-cover" />
              ) : (
                <div className="shrink-0 aspect-square bg-stone-500" />
              )}
              <div className="p-2">
                <h3 className="mx-2 font-bold line-clamp-2 wrap-anywhere">{research.title}</h3>
                <div className="flex text-xs">
                  <div className="mx-2">カテゴリー: {research.category || "不明"}</div>
                  <div className="text-stone-500 mx-2">作成: {research.created_at ? timeAgo(research.created_at) : null}</div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}