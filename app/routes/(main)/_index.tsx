import { Link, useLoaderData } from "react-router";
import { desc, eq } from "drizzle-orm";
import { researches } from "@/db/schema";
import { getDrizzleClient } from "@/lib/db";
import { timeAgo } from "@/lib/utils";

export async function loader() {
  const db = getDrizzleClient();

  const researchResults = await db.query.researches.findMany({
    where: eq(researches.status, 2),
    orderBy: [desc(researches.created_at)],
  });

  return { researches: researchResults };
}

export default function Home() {
  const { researches } = useLoaderData<typeof loader>();

  return (
    <div className="max-w-2xl mx-auto">
      <Link to={`/article/${researches[0].id}`} key={researches[0].id} className="relative flex border-b border-b-stone-500">
        {!!researches[0].thumbnail ? (
          <img src={researches[0].thumbnail} alt={researches[0].title || ""} className="flex-1 aspect-video object-cover object-top" />
        ) : (
          <div className="flex-1 aspect-video bg-stone-500" />
        )}
        <div className="absolute w-full left-0 bottom-0 p-2 text-white bg-linear-to-t from-black to-transparent">
          <h3 className="m-2 text-2xl font-bold wrap-anywhere">{researches[0].title}</h3>
          <div className="m-2 text-xs">作成: {researches[0].created_at ? timeAgo(researches[0].created_at) : null}</div>
        </div>
      </Link>
      <div className="grid">
        {researches.slice(1).map((research) => {
          return (
            <Link to={`/article/${research.id}`} key={research.id} className="h-30 p-2 flex justify-between border-b border-b-stone-500">
              <div className="p-2">
                <h3 className="mx-2 font-bold line-clamp-2 wrap-anywhere">{research.title}</h3>
                <div className="flex text-xs">
                  <div className="mx-2">カテゴリー: {research.category || "不明"}</div>
                  <div className="text-stone-500 mx-2">作成: {research.created_at ? timeAgo(research.created_at) : null}</div>
                </div>
              </div>
              {!!research.thumbnail && <img src={research.thumbnail} alt={research.title || ""} className="aspect-square object-cover" />}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
