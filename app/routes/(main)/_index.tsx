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
  })

  return { researches: researchResults };
}

export default function Home() {
  const { researches } = useLoaderData<typeof loader>();

  return (
    <div className="max-w-2xl p-2 mx-auto">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-2xl font-bold">リサーチ一覧</h2>
        <Link to="/create" className="bg-amber-700 py-2 px-4 rounded-xl">
          新しいリサーチを作成
        </Link>
      </div>
      <div className="grid gap-4">
        {researches.map((research) => {
          return (
            <Link to={`/${research.id}`} key={research.id} className="border border-stone-500 rounded-xl p-4 bg-stone-800">
              <div className="flex justify-between items-start m-2">
                <h3 className="font-bold wrap-anywhere">{research.title}</h3>
              </div>
              <div className="flex text-xs">
                <div className="text-stone-500 m-2">作成: {research.created_at ? timeAgo(research.created_at) : null}</div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
