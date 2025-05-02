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
    <div className="max-w-2xl p-2 mx-auto">
      <Link to={`/${researches[0].id}`} key={researches[0].id} className="relative flex border border-x-stone-500 border-b-stone-500">
        {!!researches[0].thumbnail ? (
          <img src={researches[0].thumbnail} alt={researches[0].title || ""} className="flex-1 aspect-video object-cover" />
        ) : (
          <div className="flex-1 aspect-video bg-stone-500" />
        )}
        <div className="absolute w-hull left-0 bottom-0 p-2">
          <h3 className="m-2 font-bold wrap-anywhere">{researches[0].title}</h3>
          <div className="text-stone-500 m-2 text-xs">作成: {researches[0].created_at ? timeAgo(researches[0].created_at) : null}</div>
        </div>
      </Link>
      <div className="grid">
        {researches.slice(1).map((research) => {
          return (
            <Link to={`/${research.id}`} key={research.id} className="h-24 flex border border-x-stone-500 border-b-stone-500">
              {!!research.thumbnail && <img src={research.thumbnail} alt={research.title || ""} className="aspect-square object-cover" />}
              <div className="p-2">
                <h3 className="m-2 font-bold wrap-anywhere">{research.title}</h3>
                <div className="text-stone-500 m-2 text-xs">作成: {research.created_at ? timeAgo(research.created_at) : null}</div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
